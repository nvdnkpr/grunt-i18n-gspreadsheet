/*
 * grunt-i18n-gspreadsheet
 * https://github.com/theoephraim/grunt-i18n-gspreadsheet
 *
 * Copyright (c) 2013 Theo Ephraim
 * Licensed under the MIT license.
 */

'use strict';

var GoogleSpreadsheet = require("google-spreadsheet");
var Step = require('step');
var _ = require('underscore');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');

module.exports = function(grunt) {

  grunt.registerMultiTask('i18n_gspreadsheet', 'Grunt plugin to generate i18n locale files from a google spreadsheet', function() {

    // default options
    var options = this.options({
      key_column: 'key',
      output_dir: 'locales',
      default_locale: 'en',
      write_default_translations: true,
      sort_keys: true
    });

    // make this task async
    var done = this.async();
    
    var locales = [];
    var translations = {};
    var gsheet = new GoogleSpreadsheet( options.document_key );
    var output_dir = path.resolve( process.cwd() + '/' + options.output_dir );

    Step(
      function setAuth(){
        if ( options.google_account && options.google_password ){
          gsheet.setAuth( options.google_account, options.google_password, this );
        } else {
          this();
        }
      },
      function fetchSheetInfo(err){
        if ( err ){
          grunt.log.error('Invalid google credentials for "' + options.google_account + '"');
          return done( false );
        }
        
        gsheet.getRows( 1, this );
      },
      function buildTranslationJson(err, rows){
        if ( err ){
          grunt.log.error( err );
          return done( false );
        }
        if ( rows.length === 0 ){
          grunt.log.error('ERROR: no translations found in sheet');
          return done( false );
        }

        // First determine which locales are supported
        var gsheet_keys = _(rows[0]).keys();
        _(gsheet_keys).each(function(locale){
          if ( locale != 'id' && locale.length == 2 ){
            locales.push( locale );
            translations[locale] = {};
          }
        });

        grunt.log.writeln( 'Found '+ rows.length.toString().cyan +' translations in ' + locales.length.toString().cyan + ' languages' );

        // read all translations into an object with the correct keys
        _(rows).each(function(row){
          var translation_key = row[options.key_column];
          if ( !translation_key ) return;
          _(locales).each(function(locale){
            if ( row[locale] ){
              translations[locale][translation_key] = row[locale];
            } else if ( locale == options.default_locale && options.write_default_translations ){
              translations[locale][translation_key] = translation_key;
            }
          });
        });
        this();
      },
      function ensureDirectoryExists(err){
        if ( err ) {
          grunt.log.error( err );
          return done( false );
        }
        
        mkdirp( output_dir, this );
      },
      function writeLocaleFiles(err){
        if ( err ) {
          grunt.log.error( err );
          return done( false );
        }

        var step = this;
        _(locales).each(function(locale){
          var file_path = output_dir + '/' + locale + '.js';
          if ( options.sort_keys ) translations[locale] = sortObjectByKeys( translations[locale] );
          var translation_json = JSON.stringify( translations[locale], null, ' ' );
          var write_options = {
            flags: 'w+'
          }
          fs.writeFile( file_path, translation_json, write_options, step.parallel() );
        });
      },
      function finish(err){
        if ( err ){
          grunt.log.error( err );
          return done( false );
        }

        grunt.log.writeln( 'Wrote translation files: ' + locales.toString().magenta );
        done();
      }
    );
  });

};


function sortObjectByKeys(map) {
  var keys = _.sortBy(_.keys(map), function(a) { return a; });
  var newmap = {};
  _.each(keys, function(k) {
      newmap[k] = map[k];
  });
  return newmap;
}

