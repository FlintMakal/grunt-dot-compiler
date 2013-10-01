/*
 * grunt-dot-compiler
 * https://github.com/tinganho/grunt-dot-compiler
 *
 * Copyright (c) 2013 Tingan Ho
 * Licensed under the MIT license.
 */

 module.exports = function(grunt) {
  "use strict";

  grunt.util = grunt.util || grunt.utils;

  var _ = grunt.util._;

  var path    = require('path'),
      fs      = require('fs'),
      cleaner = /^\s+|\s+$|[\r\n]+/gm,
      cheerio = require('cheerio'),
      doT     = require('dot');

  var gruntRoot = path.dirname(grunt.file.findup('Gruntfile.js')) + '/';

  grunt.registerMultiTask('dot', 'prepares and combines any type of template into a script include', function() {
    var self = this;
    this.files.forEach(function(file) {
      // grap the filepattern
      var template = grunt.file.expand({filter: 'isFile'}, file.src);
      // create the hogan include
      var src = GruntDotCompiler.compileTemplates(template, self.data.options);
      // write the new file
      grunt.file.write(file.dest, src);
      // log our success
      grunt.log.writeln('File "' + file.dest + '" created.');
    });
  });

  var GruntDotCompiler = {};
  GruntDotCompiler.compileTemplates = function(files, opt) {

    var js = '';

    var opt = _.defaults(opt || {}, {
      variable: 'tmpl',
      key: function(filepath) {
        return path.basename(filepath, path.extname(filepath));
      },
      prefix: 'doT.template(',
      suffix: ')',
      node: false,
      requirejs: false,
      root: gruntRoot
    });

    // Sanetize
    opt.variable = opt.variable.replace('window.', '');

    var cutVariables = function (variable) {
      var variables = variable.split('.'),
          parent = '',
          currentVariable = '',
          output = '';

      for(var i = 0, length = variables.length; i < length; i++) {
        
        currentVariable = variables[i];
        
        if( i === 0 ){
          parent = currentVariable;
          output += '  var ' + parent + ' = ' + parent + ' || {};' + grunt.util.linefeed;
        } else {
          parent = parent + '.' + currentVariable;
          output += '  ' + parent + ' = ' + parent + ' || {};' + grunt.util.linefeed;
        }

      }

      return output;
    }



    if(opt.root.substr(-1) !== '/') {
      opt.root += '/';
    }

    // RequireJS
    if(!opt.requirejs && !opt.node) {
      js += cutVariables(opt.variable);
      js += opt.variable + ' = (function(){' + grunt.util.linefeed;
    }
    if(opt.requirejs && opt.node) {
      js += 'if(typeof define !== "function") {' + grunt.util.linefeed;
      js += 'define = require(\'amdefine\')(module);' + grunt.util.linefeed;
      js += '}' + grunt.util.linefeed;
    }

    if(opt.requirejs) {
      js += 'define(function() {' + grunt.util.linefeed;
    }

    // Defining encodeHTML method for the templates
    js += 'function encodeHTMLSource() {';
    js += 'var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", \'"\': \'&#34;\', "\'": \'&#39;\', "/": \'&#47;\' },';
    js += 'matchHTML = /&(?!#?\w+;)|<|>|"|\'|\\//g;';
    js += 'return function() {';
    js += 'return this ? this.replace(matchHTML, function(m) {return encodeHTMLRules[m] || m;}) : this;';
    js += '};';
    js += '};' + grunt.util.linefeed;

    js += '  String.prototype.encodeHTML=encodeHTMLSource();' + grunt.util.linefeed;

    js += cutVariables(opt.variable);

    var defs = {};
    defs.loadfile = function( path ) {
      return fs.readFileSync( path );
    };
    defs.root = opt.root;

    files.map(function(filePath) {
      var key = opt.key(filePath);
      var contents = grunt.file.read(filePath)
        .replace(/\/\/.*\n/g,'')
        .replace(/ *load\(['|"](.*)['|"]\) */g, function(m, _filePath) {
          var _path;
          // Check relative path
          if(/^\./.test(_filePath)) {
            _path = path.join(gruntRoot, path.dirname(filePath), _filePath);
          } else {
            _path = path.join(opt.root, _filePath);
          }
          return fs.readFileSync(_path);
        })
        .replace(cleaner, '')
        .replace(/'/g, "\\'")
        .replace(/\/\*.*?\*\//gm,'')

      // iterate over all the template tag in the file and put their id as the function name (key)
      var $ = cheerio.load(contents);
      $('template').each(function (index, element) {
        var compile = opt.prefix + '\'' + $(element).html().replace(/&apos;/g, "'") + '\', undefined, defs' + opt.suffix + ';' + grunt.util.linefeed;
        compile = eval(compile);
        js += '  ' + opt.variable + "['" + $(element).attr('id') + "']=" + compile + ';' + grunt.util.linefeed;
      });
    });


    if(!opt.requirejs && !opt.node) {
      js += 'return ' + opt.variable + ';})()'
    } else if(opt.requirejs) {
      js += 'return ' + opt.variable + ';});' + grunt.util.linefeed;
    } else if(opt.simple && opt.node){
      js += '';
    } else if(opt.node) {
      js += 'module.exports = ' + opt.variable + ';';
    }

    return js;

  };

};
