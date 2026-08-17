<?php

/**
 * EMCORE Todo global-widget proof plugin for ProcessMaker 3.8.
 *
 * Phase 1 deliberately contains no database access and no task API calls. Its
 * only job is to verify that an independent plugin can publish a browser asset
 * into the shared ProcessMaker page renderer.
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
        $this->iVersion = '0.1.1';
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
    }

    public function enable()
    {
    }

    public function disable()
    {
    }
}

$pluginRegistry = &PMPluginRegistry::getSingleton();
$pluginRegistry->registerPlugin('emcoreTodo', __FILE__);

