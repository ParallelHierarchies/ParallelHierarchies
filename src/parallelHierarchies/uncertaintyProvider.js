import * as d3 from 'd3';
import * as vsup from 'vsup';

export const RIBBON_UNCERTAINTY_MODES = { NONE: 1, COLOR: 2, RIBBON: 3 };

export const CATEGORY_UNCERTAINTY_MODES = {
  NONE: 1, WHITE: 2, OPACITY: 3, GAP: 4,
};

export const UNCERTAINTY_COLOR_SCHEMES = [
  'interpolateViridis',
  'interpolateInferno',
  'interpolateMagma',
  'interpolatePlasma',
  'interpolateWarm',
  'interpolateCool',
  'interpolateCubehelixDefault',
  'interpolateBuGn',
  'interpolateBuPu',
  'interpolateGnBu',
  'interpolateOrRd',
  'interpolatePuBuGn',
  'interpolatePuBu',
  'interpolatePuRd',
  'interpolateRdPu',
  'interpolateYlGnBu',
  'interpolateYlGn',
  'interpolateYlOrBr',
  'interpolateYlOrRd',
  'interpolateRdBu',
  'interpolateBrBG',
  'interpolatePRGn',
  'interpolatePiYG',
  'interpolatePuOr',
  'interpolateRdBu',
  'interpolateRdGy',
  'interpolateRdYlBu',
  'interpolateRdYlGn',
  'interpolateSpectral',
  'interpolateBlues',
  'interpolateGreens',
  'interpolateGreys',
  'interpolateOranges',
  'interpolatePurples',
  'interpolateReds',
];

class UncertaintyProvider {
  constructor() {
    this.provider = {};

    this.uncertaintyQuantization = vsup.quantization()
      .branching(2)
      .layers(5);

    this.uncertaintyScale = d3.scaleLinear()
      .domain([1, 5])
      .range([0, 1]);

    this.valueScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, 1]);

    this.uncertaintyColorSchema = d3[UNCERTAINTY_COLOR_SCHEMES[0]];

    this.uncertaintyColorScale = vsup.scale()
      .quantize(this.uncertaintyQuantization)
      .range(this.uncertaintyColorSchema);

    this.legend = vsup.legend.arcmapLegend()
      .size(100)
      .scale(this.uncertaintyColorScale);
  }

  getColorForUncertainValue(value, uncertainty) {
    const scaledValue = this.valueScale(value);
    const scaledUncertainty = this.uncertaintyScale(uncertainty);
    return this.uncertaintyColorScale(scaledValue, scaledUncertainty);
  }

  getPercentageForUncertainty(uncertainty) {
    if (uncertainty === 0) return 0;
    return this.uncertaintyScale(uncertainty);
  }

  setValueDomain(newDomain) {
    this.valueScale.domain(newDomain);
  }

  setColorSchema(schema) {
    if (UNCERTAINTY_COLOR_SCHEMES.indexOf(schema) === -1) throw new TypeError('unknown color scale');

    this.uncertaintyColorSchema = d3[schema];
    this.uncertaintyColorScale.range(this.uncertaintyColorSchema);
  }
}

const instance = new UncertaintyProvider();

export default instance;

