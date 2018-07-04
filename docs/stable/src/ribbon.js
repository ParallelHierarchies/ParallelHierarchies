parallelHierarchies.ribbon = function() {

  let data;
  let easing = d3.easePolyOut;

  // D3 SELECTIONS
  let root; // SVG root element (=parset ribbon-<g>?)
  let path; // <path> visual reprensentation of a link between two categories
  let partialPath; // <path> that shows the part-of-whole relation on mouseover events
  let timestampPath; // <path> that indicates the difference between the two timestamps

  // SVG CONFIGURATION
  let height = -1;
  let hierarchies = null;
  let scaleY = null;
  let offset;

  let istimestampRibbon = true;

  // constructs paths as cubic bezier splines
  const ribbonPath = d3.linkHorizontal()
    .x(function(d) { return d[0] })
    .y(function(d) { return d[1] });


  let ribbon = function(selection) {
    if (scaleY == null) throw Error('ribbon: scaleY must be set');
    if (height < 0) throw Error('ribbon: height must be set and greater than 0');
    if (offset == null) throw Error('ribbon: offset must be set');
    if (data == null) throw Error('ribbon: data must be set');

    root = selection;

    draw();
  };

  ribbon.source = null;
  ribbon.target = null;

  let draw = function() {
    root.selectAll('path').remove();

    path = root.append('path')
      .attr('class', 'main')
      .attr('stroke-width', height)
      .on('mouseenter', function() {
        d3.select(this).classed('highlight', true);
        hierarchies.notify('ribbonMouseEnter', {
          'event': d3.event,
          'ribbon': data
        });
      })
      .on('mousemove', function() {
        hierarchies.notify('ribbonMouseMove', d3.event);
      });

    // add the timestamppath to indicate different values for two timestamps
    if (typeof data.timestamps === 'object') {
      let diff = (Math.abs(data.timestamps[0] - data.timestamps[1]) / d3.max(data.timestamps)) * d3.sum(data.timestamps);

      timestampPath = root.append('path')
        .attr('class', 'diff')
        .classed('increase', data.timestamps[0] < data.timestamps[1])
        .classed('decrease', data.timestamps[0] > data.timestamps[1])
        .attr('stroke-width', scaleY(diff))
        .attr('transform', 'translate(0,'+(height/2 - scaleY(diff) / 2)+')')
    }

    // add the partial path for highlighting
    partialPath = root.append('path')
      .attr('class', 'partial')
      .attr('stroke-width', height)
      .on('mousemove', function() {
        hierarchies.notify('ribbonMouseMove', d3.event);
      })
      .on('mouseout', function() {
        hierarchies.notify('ribbonMouseOut', null);
      });

    ribbon.update();
  };

  /**
   * Recalculates the path of the ribbon (including partial) using the position of the source and
   * target categories as well as the height that was bound to the data.
   * @param   {boolean} useTransition whether or not to use a transition when updating the paths
   * @return  {void}
   */
  ribbon.update = function(useTransition) {

    if (ribbon.source == null) throw Error('ribbon: source must be set');
    if (ribbon.target == null) throw Error('ribbon: target must be set');
    if (ribbon.height < 0) throw Error('ribbon: height must be set and greater than 0');

    const sourceX = ribbon.source.x() + ribbon.source.dimension().x();
    const sourceY = ribbon.source.fy == null
    ? ribbon.source.y() + ribbon.source.dimension().y() + offset.source
    : ribbon.source.fy + offset.source - ribbon.source.height() / 2 - 100;

    const targetX =  ribbon.target.dimension().x() - ribbon.target.x();
    const targetY = ribbon.target.fy == null
    ? ribbon.target.y() + ribbon.target.dimension().y() + offset.target
    : ribbon.target.fy + offset.target - ribbon.target.height() / 2 - 100;

    // for performance reasons do not call the ribbonPath (--> SVG draw) function, if the ribbon
    // datum has not changed
    const oldDatum = path.datum();
    if (sourceX === oldDatum.source[0] && sourceY === oldDatum.source[1]) {
      if (targetX === oldDatum.target[0] && targetY === oldDatum.target[1]) {
        return;
      }
    }

    const datum = {
      source: [sourceX, sourceY],
      target: [targetX, targetY]
    };

    // create a path connecting the source and target categories
    path.datum(datum);
    partialPath.datum(datum);

    if (useTransition != null && useTransition) {
      path.transition().duration(300).ease(easing).attr('d', ribbonPath);
      partialPath.transition().duration(300).ease(easing).attr('d', ribbonPath);
    } else {
      path.attr('d', ribbonPath);
      partialPath.attr('d', ribbonPath);
    }

    if (typeof data.timestamps === 'object') {
      timestampPath.datum(datum).attr('d', ribbonPath);
    }
  };

  /**
   * Given a set of items, this will set the height of the partial ribbon to the sum of items
   * this ribbon shares with the parameter.
   * @param   {object}  items  dictionary of items highlighted somewhere in the application
   * @return  {void}
   */
  ribbon.highlight = function(items) {
    if (items == null) items = [];

    let sharedItems = [];
    let keys = Object.keys(items);

    // using the data bound to this generator, compare the sets of items and get their intersection.
    for (let i = 0, len = keys.length; i < len; i++) {
      if (data.items[keys[i]] != null) sharedItems.push(items[keys[i]]);
    }

    // change the highlight class for the whole ribbon
    root.classed('highlight', sharedItems.length > 0);
    root.classed('inactive', keys.length > 0 && sharedItems.length === 0);

    let partialHeight = scaleY(hierarchies.getItemValueSum(sharedItems));

    // set the partial height of the ribbon
    partialPath.attr('stroke-width', partialHeight);
    partialPath.attr('transform', 'translate(0,'+(height/2-partialHeight/2)+')')
  };

  ribbon.subscribe = function(observer) {
    hierarchies = observer;
    return ribbon;
  };


  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

  ribbon.height = function(_) {
    if (!arguments.length) return height;
    if (typeof _ === 'number') height = _;
    else throw Error('ribbon: height must be of type number');
    return ribbon;
  }

  ribbon.scaleY = function(_) {
    if (!arguments.length) return scaleY;
    if (typeof _ === 'function') scaleY = _;
    else throw Error('ribbon: scaleY must be of type function');
    return ribbon;
  };

  ribbon.offset = function(_) {
    if (!arguments.length) return offset;
    if (typeof _ === 'object') offset = _;
    else throw Error('ribbon: offset must be of type object');
    return ribbon;
  };

  ribbon.data = function(_) {
    if (!arguments.length) return data;
    if (typeof _ === 'object') data = _;
    else throw Error('ribbon: data must be of type object');
    return ribbon;
  };

  return ribbon;
}