import * as d3 from 'd3';

import { RIBBON_UNCERTAINTY_MODES } from '../uncertaintyProvider';
import UncertaintyRibbon from './uncertaintyRibbon';
import PartialRibbon from './partialRibbon';
import ComparisonRibbon from './comparisonRibbon';
import ValueProvider from '../itemValueProvider';
import EventMediator from '../eventMediator';

const RibbonGenerator = function() {

  let data;
  const easing = d3.easePolyOut;

  // D3 SELECTIONS
  let root; // SVG root element (=parset ribbon-<g>?)
  let path; // <path> visual reprensentation of a link between two categories

  // SVG CONFIGURATION
  let height = -1;
  let uncertaintyColor = 0;
  let showsUncertainty = false;
  let scaleY = null;

  let partialRibbon;
  let uncertaintyRibbon;
  let comparisonRibbon;

  // constructs paths as cubic bezier splines
  const ribbonPath = d3.linkHorizontal()
    .x(d => d[0])
    .y(d => d[1]);

  const ribbon = function(selection) {
    if (scaleY == null) throw Error('ribbon: scaleY must be set');
    if (height < 0) throw Error('ribbon: height must be set and greater than 0');
    if (data == null) throw Error('ribbon: data must be set');

    root = selection;

    partialRibbon = new PartialRibbon()
      .parentRibbon(ribbon);

    uncertaintyRibbon = new UncertaintyRibbon()
      .parentRibbon(ribbon)
      .height(height)
      .uncertaintyHeight(ValueProvider.getUncertaintyHeightForItemList(Object.values(data.items)));

    comparisonRibbon = new ComparisonRibbon()
      .primaryDimension(ValueProvider.primaryAggregateDimension)
      .secondaryDimension(ValueProvider.secondaryAggregateDimension)
      .itemList(Object.values(data.items))
      .parentRibbon(ribbon);

    draw();
  };

  ribbon.source = null;
  ribbon.target = null;

  ribbon.getSVGPath = function(pathWidth = height) {
    const useRibbonUnc = ValueProvider.ribbonUncertaintyMode === RIBBON_UNCERTAINTY_MODES.RIBBON;
    const uncertaintyMargin = useRibbonUnc ? 0 : 0;
    const sourceWidth = ribbon.source.width();
    const sourceW = sourceWidth / 2;
    const targetWidth = ribbon.target.width();
    const targetW = targetWidth / 2;

    // fy property indicates fisheye is active
    const sourceX = ribbon.source.x() + ribbon.source.dimension().x() + uncertaintyMargin + sourceW;
    const sourceY = ribbon.source.y() + ribbon.source.dimension().y() + data.sourceOffset;

    const targetX = ribbon.target.dimension().x() - ribbon.target.x() - uncertaintyMargin - targetW;
    const targetY = ribbon.target.dimension().y() + ribbon.target.y() + data.targetOffset;

    const datumSourceTarget = {
      source: [sourceX, sourceY - (pathWidth / 2)],
      target: [targetX, targetY - (pathWidth / 2)],
    };
    const datumTargetSource = {
      target: [sourceX, sourceY + (pathWidth / 2)],
      source: [targetX, targetY + (pathWidth / 2)],
    };

    const segmentSourceTarget = ribbonPath(datumSourceTarget);
    let segmentTargetSource = ribbonPath(datumTargetSource);

    segmentTargetSource = segmentTargetSource.split('M');
    segmentTargetSource[0] = 'L';
    segmentTargetSource = segmentTargetSource.join('');
    segmentTargetSource += 'Z';

    return segmentSourceTarget + segmentTargetSource;
  };

  let draw = function() {
    root.selectAll('path').remove();

    root
      .on('mouseenter', () => {
        EventMediator.notify('ribbonMouseEnter', {
          'event': d3.event,
          'ribbon': data,
        });
      })
      .on('mouseleave', () => {
        EventMediator.notify('ribbonMouseOut', null);
      })
      .on('mousemove', () => {
        EventMediator.notify('ribbonMouseMove', {
          'event': d3.event,
          'ribbon': data,
        });
      });

    path = root.append('path')
      .attr('class', 'main');

    root.append('g').attr('class', 'partial').call(partialRibbon);
    root.append('g').attr('class', 'uncertainty').call(uncertaintyRibbon);
    root.append('g').attr('class', 'comparison').call(comparisonRibbon);

    ribbon.update();
  };

  /**
   * Recalculates the path of the ribbon (including partial) using the position of the source and
   * target categories as well as the height that was bound to the data.
   * @param   {boolean} useTransition whether or not to use a transition when updating the paths
   * @return  {void}
   */
  ribbon.update = function(useTransition = true) {

    if (ribbon.source == null) throw Error('ribbon: source must be set');
    if (ribbon.target == null) throw Error('ribbon: target must be set');

    const duration = useTransition ? 400 : 0;

    path.classed('uncertainty', showsUncertainty);

    path.transition().duration(duration).ease(easing)
      .style('fill', uncertaintyColor)
      .attr('height', height)
      .attr('d', ribbon.getSVGPath());

    partialRibbon.update(useTransition);

    uncertaintyRibbon
      .uncertaintyHeight(ValueProvider.getRibbonUncertaintyHeightForItemList(Object.values(data.items)))
      .update(useTransition);

    comparisonRibbon
      .primaryDimension(ValueProvider.primaryAggregateDimension)
      .secondaryDimension(ValueProvider.secondaryAggregateDimension)
      .update();
  };

  /**
   * Given a set of items, this will set the height of the partial ribbon to the sum of items
   * this ribbon shares with the parameter.
   * @param   {object}  items  dictionary of items highlighted somewhere in the application
   * @return  {void}
   */
  ribbon.highlight = function(items) {
    setTimeout(() => {
      const sharedItems = [];
      const keys = Object.keys(data.items);

      // using the data bound to this generator, compare the sets of items and get their
      // intersection.
      for (let i = 0, len = keys.length; i < len; i++) {
        if (items[keys[i]] != null) sharedItems.push(items[keys[i]]);
      }

      // change the highlight class for the whole ribbon
      root.classed('highlight', sharedItems.length > 0);
      root.classed('faded', sharedItems.length === 0 && Object.keys(items).length > 0);

      let partialHeight = scaleY(ValueProvider.getActiveItemValueSumForAllAggregates(sharedItems));
      partialHeight = Math.max(1, partialHeight);

      partialRibbon
        .height(partialHeight)
        .offsetY((height / 2) - (partialHeight / 2))
        .update(false);

    }, 0);
  };

  ribbon.fisheye = function() {
    ribbon.update(false);
  };


  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

  ribbon.height = function(_) {
    if (!arguments.length) return height;
    if (typeof _ === 'number') height = _;
    else throw Error('ribbon: height must be of type number');
    return ribbon;
  };

  ribbon.scaleY = function(_) {
    if (!arguments.length) return scaleY;
    if (typeof _ === 'function') scaleY = _;
    else throw Error('ribbon: scaleY must be of type function');
    return ribbon;
  };

  ribbon.uncertaintyColor = function(_) {
    if (!arguments.length) return uncertaintyColor;
    uncertaintyColor = _;
    return ribbon;
  };

  ribbon.showsUncertainty = function(_) {
    if (!arguments.length) return showsUncertainty;
    showsUncertainty = _;
    return ribbon;
  };

  ribbon.data = function(_) {
    if (!arguments.length) return data;
    if (typeof _ === 'object') data = _;
    else throw Error('ribbon: data must be of type object');
    return ribbon;
  };

  return ribbon;
};

export default RibbonGenerator;