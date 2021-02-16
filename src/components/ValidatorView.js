'use strict';

var aboutDialogTemplateUrl = require('ngtemplate-loader?relativeTo=/src/!html-loader!../dialogs/About.html');

var templateUrl = require('ngtemplate-loader?relativeTo=/src/!html-loader!./validator-view.html');

function ValidatorViewController($scope, $rootScope, $log, $http, $window, $q, $route, $location, $uibModal, $templateCache, gist, markupJson, markupYaml, validatorFactoryJSV, validatorFactoryAJV, alertService, textService) {

  var self = this;
  this.parseSchema = null;
  this.parseDocument = null;
  this.validateSchema = null;
  this.validateDocument = null;

  // Set up spec versions
  this.validators = {
    'draft-01': {
      service: validatorFactoryJSV('draft-01'),
      name: 'draft-01'
    },
    'draft-02': {
      service: validatorFactoryJSV('draft-02'),
      name: 'draft-02'
    },
    'draft-03': {
      service: validatorFactoryJSV('draft-03'),
      name: 'draft-03'
    },
    'draft-04': {
      service: validatorFactoryAJV('draft-04'),
      name: 'draft-04'
    },
    'draft-06': {
      service: validatorFactoryAJV('draft-06'),
      name: 'draft-06'
    },
    'draft-07': {
      service: validatorFactoryAJV('draft-07'),
      name: 'draft-07',
      label: 'draft-07 (latest)'
    },
    // RETIRED schema versions
    'v5-unofficial': {
      name: 'v5-unofficial',
      alerts: [{
        className: 'alert-danger',
        content_tid: 'WARNING_V5_UNOFFICIAL'
      }],
      hidden: true
    },
    'experimental': {
      name: 'experimental',
      alerts: [{
        className: 'alert-danger',
        content_tid: 'WARNING_EXPERIMENTAL'
      }],
      hidden: true
    }
  };
  this.validatorsArr = function() {
    return Object.values(this.validators);
  };

  // Set up markup languages
  this.markupLanguages = {
    'json': {
      service: markupJson,
      name: 'JSON'
    },
    'yaml': {
      service: markupYaml,
      name: 'YAML'
    }
  };

  this.schemaService = markupYaml;
  this.documentService = markupJson;

  this.about = function(event) {
    // Stop the link redirecting us to #
    event.preventDefault();
    event.stopPropagation();

    alertService.alert({title: '{{ "ABOUT" | translate }}', message: $templateCache.get(aboutDialogTemplateUrl), btnClass: 'btn-primary', size: 'lg'});

    return false;
  };

  // Getters
  this.getDocument = textService.getDocument;
  this.getSchema = textService.getSchema;

  // Reset everything
  this.reset = textService.reset;

  // Load a sample
  this.sample = function(ref) {
    $log.debug('sample', ref);

    var p = this.getCurrentMarkupService();
    // Function
    p.then(function(markupService) {
      $http.get('samples/' + ref + '.document.json').then(function(response) {
        markupService.prettyPrint(response.data).then(function(text) {
          textService.setDocument(text);
        });
      });
      $http.get('samples/' + ref + '.schema.json').then(function(response) {
        markupService.prettyPrint(response.data).then(function(text) {
          textService.setSchema(text);
        });
      });
    }, function(errors) {
      alertService.alert({title: '{{ "ERROR_SAMPLE_LOADING" | translate }}', message: errors[0].message, btnClass: 'btn-danger'});
    });
  };

  // Load a Gist by ID
  this.loadGist = function(gistId) {
    this.loadedGistId = gistId;

    var p = gist.retrieve(gistId);
    // Function
    p.then(function(gist) {
      $log.info('Retrieved gist', gistId, gist);

      self.loadedGist = gist;

      textService.setSchema(gist.schema);
      textService.setDocument(gist.document);

      // Register a once-off listener - if schema or document change, clobber the gist param
      var canceller,
        documentListener,
        schemaListener;
      canceller = function() {
        $log.info('Content changed from loaded gist, altering state to allow for this');
        // Don't show the gist ID in the URL
        $route.updateParams({gist: null});
        // Clear the watch
        schemaListener && schemaListener();
        documentListener && documentListener();
        // Clobber the local "we're looking at a gist" variables
        delete self.loadedGist;
        delete self.loadedGistId;
      };
      schemaListener = $scope.$watch('$ctrl.getSchema()', function(newValue) {
        if (self.loadedGist && newValue !== self.loadedGist.schema) {
          canceller();
        }
      });
      documentListener = $scope.$watch('$ctrl.getDocument()', function(newValue) {
        if (self.loadedGist && newValue !== self.loadedGist.document) {
          canceller();
        }
      });

    }, function(error) {
      $log.error(error);
      alertService.alert({title: '{{ "ERROR_GIST_LOADING" | translate }}', message: error, btnClass: 'btn-danger'});
    });
  };

  // Save a Gist and inform of success
  this.saveGist = function() {
    var p = gist.save(textService.getSchema(), textService.getDocument());
    // Function
    p.then(function(gistId) {
      $route.updateParams({gist: gistId});
      var url = $location.absUrl();
      alertService.alert({
        title: '{{ "GIST_SAVED" | translate }}',
        message: '<a target="_blank" href="' + url + '">{{ "GIST_VISIT" | translate }}</a>'
      });
    }, function(error) {
      $log.error(error);
      alertService.alert({title: '{{ "ERROR_GIST_SAVING" | translate }}', message: error, btnClass: 'btn-danger'});

    });
  };

  // Change the selected spec version
  this.setSpecVersion = function(specVersion) {
    $route.updateParams({specVersion: specVersion});
  };

  // Change the selected markup
  this.setMarkupLanguage = function(markupLanguage) {
    $route.updateParams({markupLanguage: markupLanguage});
  };

  // Wrapper functions to be bound to the Validator inputs
  this._parseSchema = function(text) {
    $log.debug('_parseSchema');
    return $q.when(this.schemaService).then(function(service) {
      return service.parse(text);
    });
  };
  this._prettyPrintSchema = function(obj) {
    $log.debug('_prettyPrint', obj);
    return $q.when(this.schemaService).then(function(service) {
      return service.prettyPrint(obj);
    });
  };
  this._parseDocument = function(text) {
    $log.debug('_parseDocument');
    return $q.when(this.documentService).then(function(service) {
      return service.parse(text);
    });
  };
  this._prettyPrintDocument = function(obj) {
    $log.debug('_prettyPrintdocument', obj);
    return $q.when(this.documentService).then(function(service) {
      return service.prettyPrint(obj);
    });
  };
  this._validateSchema = function(obj) {
    $log.debug('_validateSchema', obj);
    return this.getCurrentValidationService().then(function(service) {
      return service.validateSchema(obj);
    });
  };
  this._validateDocument = function(schemaObj, obj) {
    $log.debug('_validateDocument', schemaObj, obj);
    if (!schemaObj) {
      return $q.reject([
        {
          message_tid: 'ERROR_INVALID_SCHEMA'
        }
      ]);
    }
    return this.getCurrentValidationService().then(function(service) {
      return service.validate(schemaObj, obj);
    });
  };

  // Get currently referred-to validation service object
  this.getCurrentValidationService = function() {
    $log.debug('getCurrentValidationService');
    if (!this.currentValidator) {
      // Abort
      return $q.reject([
        {
          message_tid: 'ERROR_INVALID_VERSION',
          message_params: self.currentParams
        }
      ]);
    }
    return $q.when(this.currentValidator.service);
  }

  // Get currently referred-to markup service object
  this.getCurrentMarkupService = function() {
    $log.debug('getCurrentMarkupService');
    if (!this.currentMarkup) {
      return $q.reject([
        {
          message_tid: 'ERROR_INVALID_MARKUP',
          message_params: self.currentParams
        }
      ]);
    }
    return $q.when(this.currentMarkup.service);
  }

  // When the route changes, register the new versions
  $log.info('Selected JSON Schema version :: ' + $route.current.params.specVersion);
  self.currentValidator = self.validators[$route.current.params.specVersion];
  self.validateSchema = angular.bind(self, self._validateSchema);
  self.validateDocument = angular.bind(self, self._validateDocument, null);

  $log.info('Selected markup language :: ' + $route.current.params.markupLanguage);
  self.currentMarkup = self.markupLanguages[$route.current.params.markupLanguage];
  self.parseSchema = angular.bind(self, self._parseSchema);
  self.parseDocument = angular.bind(self, self._parseDocument);
  self.prettyPrintSchema = angular.bind(self, self._prettyPrintSchema);
  self.prettyPrintDocument = angular.bind(self, self._prettyPrintDocument);

  if ($route.current.params.gist && self.loadedGistId != $route.current.params.gist) {
    $log.info('Loading gist :: ' + $route.current.params.gist, self.loadedGistId);
    self.loadGist($route.current.params.gist);
  }

  // Notice when Validator components tell us things have changed
  this.onUpdateSchemaObj = function(obj) {
    // Re-bind validateDocument so an update happens
    $log.debug('Schema object changed');
    this.validateDocument = angular.bind(this, this._validateDocument, obj);
  };
  this.onUpdateDocumentString = function(doc) {
    $log.debug('Document string changed');
    textService.setDocument(doc);
  };
  this.onUpdateSchemaString = function(doc) {
    $log.debug('Schema string changed');
    textService.setSchema(doc);
  };

}

angular.module('app').component('validatorView', {
  templateUrl: templateUrl,
  controller: ValidatorViewController
});
