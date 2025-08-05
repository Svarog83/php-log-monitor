<?php

function asyncHttpGet(string $host, string $path = '/', int $port = 80): Fiber
{
    return new Fiber(function () use ($host, $path, $port) {
        $errno = $errstr = null;
        $socket = stream_socket_client("tcp://$host:$port", $errno, $errstr, 5, STREAM_CLIENT_ASYNC_CONNECT | STREAM_CLIENT_CONNECT);

        if (!$socket) {
            throw new RuntimeException("Connection failed: $errstr ($errno)");
        }

        stream_set_blocking($socket, false);

        // Ждём, пока соединение будет установлено
        while (!feof($socket)) {
            $r = $w = [$socket];
            $e = null;
            if (stream_select($r, $w, $e, 0, 50000)) {
                break;
            }
            Fiber::suspend();
        }

        $request = "GET $path HTTP/1.1\r\nHost: $host\r\nConnection: close\r\n\r\n";
        fwrite($socket, $request);

        $response = '';
        while (!feof($socket)) {
            $r = [$socket];
            $w = $e = null;
            if (stream_select($r, $w, $e, 0, 50000)) {
                $chunk = fread($socket, 4096);
                if ($chunk === false) break;
                $response .= $chunk;
            }
            Fiber::suspend();
        }

        fclose($socket);
        return $response;
    });
}

// Список хостов и путей
$targets = [
    ['host' => 'postman-echo.com', 'path' => '/delay/4'],
    ['host' => 'postman-echo.com', 'path' => '/delay/3'],
    ['host' => 'postman-echo.com', 'path' => '/delay/1'],
    ['host' => 'postman-echo.com', 'path' => '/delay/2'],
    ['host' => 'postman-echo.com', 'path' => '/delay/5'],
    ['host' => 'postman-echo.com', 'path' => '/delay/2'],
    ['host' => 'postman-echo.com', 'path' => '/delay/5'],
    ['host' => 'postman-echo.com', 'path' => '/delay/2'],
    ['host' => 'postman-echo.com', 'path' => '/delay/2'],
    ['host' => 'postman-echo.com', 'path' => '/delay/0'],
];

$fibers = [];

// Стартуем fibers
foreach ($targets as $target) {
    $fiber = asyncHttpGet($target['host'], $target['path']);
    $fiber->start();
    $fibers[] = $fiber;
}

$start = microtime(true);
// Event loop
while (!empty($fibers)) {
    foreach ($fibers as $key => $fiber) {
        if ($fiber->isSuspended()) {
            $fiber->resume();
        }

        if ($fiber->isTerminated()) {
            echo "Response $key:\n";
            echo $fiber->getReturn() . "\n\n";
            unset($fibers[$key]);
        }
    }

    usleep(10000);
}
$end = microtime(true);
echo sprintf("Total time: %.2f\n seconds", $end - $start);

