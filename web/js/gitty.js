/**
 * @fileOverview
 * Dialog components to interact with the gitty store.
 *
 * @version 0.2.0
 * @author Jan Wielemaker, J.Wielemaker@vu.nl
 * @requires jquery
 */

define([ "jquery", "config", "form", "laconic" ],
       function($, config, form) {

(function($) {
  var pluginName = 'gitty';

  /** @lends $.fn.gitty */
  var methods = {
    /**
     * @param {Object} options
     * @param {Object.meta} provides the gitty meta-data
     */
    _init: function(options) {
      return this.each(function() {
	var elem = $(this);
	var data = elem.data(pluginName)||{};
	var meta = options.meta;
	var history, tabs;
	var henabled;

	function tab(label, active, id, disabled) {
	  var attrs = {role:"presentation"};
	  var classes = [];
	  if ( active   ) classes.push("active");
	  if ( disabled ) classes.push("disabled");
	  if ( classes != [] )
	    attrs.class = classes.join(" ");
	  var elem =
	  $.el.li(attrs, $.el.a({href:"#"+id, 'data-toggle':"tab"}, label));
	  return elem;
	}

	henabled = !Boolean(meta.previous);
	tabs     = $($.el.div({class:"tab-content"}));

	elem.append($.el.ul(
	  {class:"nav nav-tabs"},
	  tab("Meta data", true,  "gitty-meta-data"),
	  tab("History",   false, "gitty-history",  henabled),
	  tab("Changes",   false, "gitty-diff",     henabled)));
	elem.append(tabs);

	/* meta-data tab */
	tabs.append($.el.div(
	  { class:"tab-pane fade in active",
	    id:"gitty-meta-data"},
	  $.el.form({class:"form-horizontal"},
		    form.fields.fileName(options.file, meta.public,
					 true), // disabled
		    form.fields.title(meta.title),
		    form.fields.author(meta.author),
		    form.fields.tags(meta.tags),
		    form.fields.buttons(
		      { label: "Update meta data",
			action: function(ev,data) {
			  console.log(data);
			  data.name = options.file;
			  editor.prologEditor('save', data, "only-meta-data");
			  return false;
			}
		      }))));

	/* history tab */
	history = $.el.div({ class:"tab-pane fade",
			     id:"gitty-history"}),
	tabs.append(history);
	elem.find('[href="#gitty-history"]').on("show.bs.tab", function(ev) {
	  $(history).gitty('showHistory', {file:options.file});
	});

	/* diff/changes tab */
	tabs.append($.el.div({class:"tab-pane fade", id:"gitty-diff"}));
      });

      return this;
    },

    /**
     * @param is the gitty meta-object
     * @return {DOM} node holding the title
     */
    title: function(meta) {
      var title = $.el.span("File ", $.el.span({class:"filename"}, meta.name));
      if ( meta.symbolic != "HEAD" && meta.commit )
	$(title).append("@", $.el.span({class:"sha1 abbrev"},
				       meta.commit.substring(0,7)));

      return title;
    },


		 /*******************************
		 *	     COMMIT LOG		*
		 *******************************/

    /**
     * Show a commit log for options.file.
     * @param {Object} options
     * @param {String} options.file is the file name in the gitty store
     */
    showHistory: function(options) {
      return this.each(function() {
	var elem = $(this);
	var data = elem.data(pluginName)||{};	/* private data */
	var url  = config.http.locations.web_storage
		 + "/" + encodeURI(options.file);

	if ( data.file == options.file )
	  return;
	data.file = options.file;

	elem.html("");
	elem.append($.el.table({class:"table table-striped table-condensed gitty-history"},
			       $.el.tr($.el.th("Changed"),
				       $.el.th("Date"),
				       $.el.th("Author"),
				       $.el.th("Actions"))));

	$.ajax({ url: url,
		 contentType: "application/json",
		 type: "GET",
		 data: { format: "history"
		 },
		 success: function(reply) {
		   elem.gitty('fillHistoryTable', reply);
		 },
		 error: function() {
		   alert("Failed to fetch history");
		 }
	       });

	elem.data(pluginName, data);	/* store with element */
      });
    },

    /**
     * Fill the history table
     */
    fillHistoryTable: function(history) {
      var table = this.find(".table.gitty-history");

      function versionActions(h) {
	return $.el.span(form.widgets.glyphIconButton("glyphicon-zoom-in",
						      {action:"diff",
						       title:"Show changes"}),
			 form.widgets.glyphIconButton("glyphicon-play",
						      {action:"play",
						       title:"Open in SWISH"}));
      }

      for(var i=0; i<history.length; i++) {
	var h = history[i];

	table.append($.el.tr({"data-commit":h.commit},
			     $.el.td({class:"commit-message"},
				     h.commit_message||"No comment"),
			     $.el.td({class:"date"},
				     new Date(h.time*1000).toLocaleString()),
			     $.el.td({class:"author"},
				     h.author||"No author"),
			     $.el.td(versionActions(h))));
      }

      table.on("click", "button", function(ev) {
	var button = $(ev.target);
	var commit = button.parents("tr").data("commit");
	var action = button.data("action");

	if ( action == "play" ) {
	  window.location = config.http.locations.web_storage + "/" + commit;
	} else if ( action == "diff" ) {
	  var diffA = button.parents("div.tab-content")
                            .parent()
			    .find("[href='#gitty-diff']");
	  $("#gitty-diff").gitty('showDiff', { file:commit });
          diffA.tab('show');
	}
      });
    },

		 /*******************************
		 *	       DIFFS		*
		 *******************************/

    /**
     * Show diff of a given file
     * @param {Object} options
     * @param {String} options.file is the file for which to show diffs
     * @param {String} [options.base] is the base SHA1 (defaults to
     * HEAD^)
     */

    showDiff: function(options) {
      return this.each(function() {
	var elem = $(this);
	var data = elem.data(pluginName)||{};	/* private data */
	var url  = config.http.locations.web_storage
		 + "/" + encodeURI(options.file);

	if ( data.file == options.file && data.base == options.base )
	  return;
	data.file = options.file;
	data.base = options.base;

	elem.html("");

	$.ajax({ url: url,
		 contentType: "application/json",
		 type: "GET",
		 data: { format: "diff"
		 },
		 success: function(reply) {
		   elem.gitty('fillDiff', reply);
		 },
		 error: function() {
		   alert("Failed to fetch diff");
		 }
	       });

	elem.data(pluginName, data);	/* store with element */
      });
    },

    fillDiff: function(diff) {
      if ( diff.tags ) this.gitty('diffTags', diff.tags);
      if ( diff.data ) this.gitty('udiffData', diff.data);
    },

    diffTags: function(diff) {
      var div = $($.el.div({class:"diff-tags"},
			    $.el.label("Edited tags")));

      function addTag(tag, className) {
	div.append($.el.span({class: "diff-tag "+className}, tag));
      }

      for(var i=0; i<diff.deleted.length; i++)
	addTag(diff.deleted[i], "deleted");
      for(var i=0; i<diff.added.length; i++)
	addTag(diff.added[i], "added");

      this.append(div);

      return this;
    },

    udiffData: function(diff) {
      var lines = diff.split("\n");
      var pre = $($.el.pre({class:"udiff"}));

      for(var i=0; i<lines.length; i++) {
	var line = lines[i];
	var classmap = { '@': 'udiff-hdr',
			 ' ': 'udiff-ctx',
			 '+': 'udiff-add',
			 '-': 'udiff-del'
		       };
	pre.append($.el.span({class:classmap[line.charAt(0)]}, line),
		   $.el.br());
      }

      this.append(pre);
    }
  }; // methods

  // <private functions>

  /**
   * <Class description>
   *
   * @class gitty
   * @tutorial jquery-doc
   * @memberOf $.fn
   * @param {String|Object} [method] Either a method name or the jQuery
   * plugin initialization object.
   * @param [...] Zero or more arguments passed to the jQuery `method`
   */

  $.fn.gitty = function(method) {
    if ( methods[method] ) {
      return methods[method]
	.apply(this, Array.prototype.slice.call(arguments, 1));
    } else if ( typeof method === 'object' || !method ) {
      return methods._init.apply(this, arguments);
    } else {
      $.error('Method ' + method + ' does not exist on jQuery.' + pluginName);
    }
  };
}(jQuery));
});
