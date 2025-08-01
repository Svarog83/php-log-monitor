<?php

declare(strict_types=1);

use Revolt\EventLoop;
use function Amp\File\getSize;

require 'vendor/autoload.php';

$path = '/Users/checkito/workspace/it-training/loop/var/log/logstash-2025-06-04.json';
$lastSize = getSize($path); ;
echo 'last size: ' . $lastSize;
EventLoop::repeat(1.0, function () use (&$lastSize, $path) {
    echo ' repeating';
    try {
        clearstatcache(true, $path);
        $size = getSize($path); // direct int, no await/yield

        if ($lastSize !== null && $size !== $lastSize) {
            echo "File size changed: $size bytes\n";
        }

        $lastSize = $size;
    } catch (\Throwable $e) {
        echo "Error reading size: " . $e->getMessage() . "\n";
    }
});

EventLoop::run();