<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\Console\MonitorCommand;
use Symfony\Component\Console\Application;

$application = new Application('Log Monitor', '1.0.0');
$application->add(new MonitorCommand());
$application->setDefaultCommand('monitor', true);

$application->run(); 