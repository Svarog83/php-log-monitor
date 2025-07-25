<?php

declare(strict_types=1);

namespace Tests;

use App\Application\Configuration\ProjectConfiguration;
use App\Domain\Model\Project;
use PHPUnit\Framework\TestCase;

class LogMonitorTest extends TestCase
{
    public function testProjectConfigurationLoadsCorrectly(): void
    {
        $config = new ProjectConfiguration([
            'test' => new Project('test', [__DIR__], 'test-*.log')
        ]);

        $this->assertTrue($config->hasProject('test'));
        $this->assertInstanceOf(Project::class, $config->getProject('test'));
        $this->assertEquals('test', $config->getProject('test')?->name);
    }

    public function testProjectValidation(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new Project('', [__DIR__]);
    }

    public function testProjectWithEmptyDirectories(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new Project('test', []);
    }
} 