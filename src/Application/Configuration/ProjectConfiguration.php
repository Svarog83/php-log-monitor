<?php

declare(strict_types=1);

namespace App\Application\Configuration;

use App\Domain\Model\Project;
use Symfony\Component\Yaml\Yaml;

/**
 * Configuration management for projects
 */
final class ProjectConfiguration
{
    /**
     * @param array<string, Project> $projects
     */
    public function __construct(
        private array $projects = []
    ) {
    }

    /**
     * Load projects from YAML configuration file
     */
    public static function fromYamlFile(string $configPath): self
    {
        if (!file_exists($configPath)) {
            throw new \InvalidArgumentException("Configuration file not found: {$configPath}");
        }

        $config = Yaml::parseFile($configPath);
        if (!is_array($config)) {
            throw new \InvalidArgumentException("Invalid configuration format");
        }

        $projects = [];

        $projectsConfig = $config['projects'] ?? [];
        if (!is_array($projectsConfig)) {
            throw new \InvalidArgumentException("Invalid projects configuration");
        }

        foreach ($projectsConfig as $projectName => $projectConfig) {
            if (!is_string($projectName)) {
                throw new \InvalidArgumentException("Project name must be a string");
            }

            if (!is_array($projectConfig)) {
                throw new \InvalidArgumentException("Project configuration must be an array");
            }

            $directories = $projectConfig['directories'] ?? [];
            if (!is_array($directories)) {
                throw new \InvalidArgumentException("Directories must be an array");
            }

            $logPattern = $projectConfig['log_pattern'] ?? 'logstash-*.json';
            if (!is_string($logPattern)) {
                throw new \InvalidArgumentException("Log pattern must be a string");
            }

            $projects[$projectName] = new Project(
                name: $projectName,
                monitoredDirectories: $directories,
                logPattern: $logPattern
            );
        }

        return new self($projects);
    }

    /**
     * @return array<string, Project>
     */
    public function getProjects(): array
    {
        return $this->projects;
    }

    public function getProject(string $name): ?Project
    {
        return $this->projects[$name] ?? null;
    }

    public function hasProject(string $name): bool
    {
        return isset($this->projects[$name]);
    }
} 