<?php

/**
 * EMCORE Todo private personal task plugin for ProcessMaker 3.8.
 */

G::LoadClass('plugin');

class emcoreTodoPlugin extends PMPlugin
{
    public function __construct($sNamespace, $sFilename = null)
    {
        $result = parent::PMPlugin($sNamespace, $sFilename);
        $this->sFriendlyName = 'EMCORE Todo';
        $this->sDescription = 'Private personal todo module for EMCORE';
        $this->sPluginFolder = 'emcoreTodo';
        $this->sSetupPage = '';
        $this->iVersion = '0.3.1';
        $this->aWorkspaces = null;
        return $result;
    }

    public function setup()
    {
        // Standard ProcessMaker pages consume this copy of the widget.
        // The custom interface renderer uses the separately deployed bridge.
        $publisher = &headPublisher::getSingleton();
        $publisher->addExtJsScript('emcoreTodo/todoWidget', false);
    }

    public function install()
    {
        $this->ensureSchema();
    }

    public function enable()
    {
        $this->ensureSchema();
    }

    public function disable()
    {
    }

    private function ensureSchema()
    {
        require_once PATH_PLUGINS . $this->sPluginFolder . '/classes/class.todoRepository.php';
        EmcoreTodoRepository::ensureSchema();
    }
}

$pluginRegistry = &PMPluginRegistry::getSingleton();
$pluginRegistry->registerPlugin('emcoreTodo', __FILE__);
