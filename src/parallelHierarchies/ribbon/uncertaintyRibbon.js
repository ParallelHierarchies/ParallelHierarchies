import * as d3 from 'd3';

import UncertaintyProvider from '../uncertaintyProvider';

const NUMBER_OF_LAYERS = 20;

export default function UncertaintyRibbon() {
  let root;

  let layers;
  let layer;

  const easing = d3.easePolyOut;

  let height = -1;
  let uncertaintyHeight = -1;

  let parentRibbon;

  const uncertaintyRibbon = function(selection) {
    root = selection;

    draw();
  };

  let draw = function() {
    layers = root.append('g').attr('class', 'layers');

    layer = layers.selectAll('path').data(d3.range(NUMBER_OF_LAYERS)).enter()
      .append('path')
      .attr('class', 'uncertainty');
  };

  uncertaintyRibbon.update = function(useTransition) {
    if (uncertaintyHeight === 0) return;

    const duration = useTransition ? 250 : 0;

    const layerColorScale = d3.scaleSequential(UncertaintyProvider.uncertaintyColorSchema)
      .domain([0, NUMBER_OF_LAYERS - 1]);

    layer.attr('fill', layerColorScale);

    layers.transition().duration(duration).ease(easing)
      .attr('transform', `translate(0,${-(height / 2)})`);

    layer.transition().duration(duration).ease(easing)
      .attr('d', parentRibbon.getSVGPath(uncertaintyHeight / NUMBER_OF_LAYERS))
      .attr('transform', (d, i) => `translate(0,${(i + 0.5) * (uncertaintyHeight / NUMBER_OF_LAYERS)})`);
  };


  uncertaintyRibbon.parentRibbon = function(_) {
    if (!arguments.length) return parentRibbon;
    parentRibbon = _;
    return uncertaintyRibbon;
  };

  uncertaintyRibbon.uncertaintyHeight = function(_) {
    if (!arguments.length) return uncertaintyHeight;
    uncertaintyHeight = _;
    return uncertaintyRibbon;
  };

  uncertaintyRibbon.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return uncertaintyRibbon;
  };

  return uncertaintyRibbon;
}