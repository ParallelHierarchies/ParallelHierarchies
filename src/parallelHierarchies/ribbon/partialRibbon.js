import * as d3 from 'd3';

export default function PartialRibbon() {
  let root;

  let path;

  let height = 0;
  let offsetY = 0;
  let parentRibbon = null;

  const easing = d3.easePolyOut;


  const partialRibbon = function(selection) {
    root = selection;

    draw();
  };

  let draw = function() {
    root.select('path.partial').remove();

    path = root.append('path')
      .attr('class', 'partial');
  };

  partialRibbon.update = function(useTransition) {
    const duration = useTransition ? 400 : 0;

    path.transition().duration(duration).ease(easing)
      .attr('d', parentRibbon.getSVGPath(height))
      .attr('transform', `translate(0,${(offsetY)})`);
  };


  partialRibbon.offsetY = function(_) {
    if (!arguments.length) return offsetY;
    offsetY = _;
    return partialRibbon;
  };

  partialRibbon.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return partialRibbon;
  };

  partialRibbon.parentRibbon = function(_) {
    if (!arguments.length) return parentRibbon;
    parentRibbon = _;
    return partialRibbon;
  };

  return partialRibbon;
}