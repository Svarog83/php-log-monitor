<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\Application\Configuration\EnvironmentConfiguration;
use App\Console\MonitorCommand;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Input\ArgvInput;
use Symfony\Component\VarDumper\Cloner\VarCloner;
use Symfony\Component\VarDumper\Dumper\CliDumper;
use Symfony\Component\VarDumper\Dumper\ServerDumper;
use Symfony\Component\VarDumper\VarDumper;

try {
    // Check if debug flag is present in command line arguments
    $input = new ArgvInput();
    $isDebug = $input->hasParameterOption(['--debug', '-d']);

    // Load environment configuration
    $envConfig = new EnvironmentConfiguration('.env');

    // Configure Symfony VarDumper based on debug flag
    if ($isDebug) {
        // Use CLI dumper for debug output
        VarDumper::setHandler(function ($var) {
            $cloner = new VarCloner();
            $dumper = new CliDumper();
            $dumper->dump($cloner->cloneVar($var));
        });
    } elseif ($envConfig->getVarDumperFormat() === 'server') {
        // Use server dumper for normal operation
        VarDumper::setHandler(function ($var) use ($envConfig) {
            $cloner = new VarCloner();
            $dumper = new ServerDumper($envConfig->getVarDumperServer());
            $dumper->dump($cloner->cloneVar($var));
        });
    }

    $application = new Application('Log Monitor', '1.0.0');
    $application->add(new MonitorCommand());
    $application->setDefaultCommand('monitor', true);

    $application->run();
}
catch (\Throwable $e) {
    dd($e->getMessage());
}