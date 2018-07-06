const WIDTH = window.innerWidth - 20;
const HEIGHT = window.innerHeight - 250;
const COLORS = ['#77AADD', '#77CCCC', '#88CCAA', '#DDDD77', '#DDAA77', '#DD7788', '#CC99BB'];
const CONFIGURATIONS = {
  'census10k': {
    schemaURI: './data/Census/census_schema.json',
    itemsURI: './data/Census/census_items_10k.csv'
  },
  'census100k': {
    schemaURI: './data/Census/census_schema.json',
    itemsURI: './data/Census/census_items_100k.csv'
  },
  'ontology': {
    schemaURI: './data/Ontology/ontology_schema.json',
    itemsURI: './data/Ontology/ontology_items.csv'
  }
};

const svg = d3.select('#parallelHierarchies')
  .attr('width', WIDTH)
  .attr('height', HEIGHT);

let dataProvider;
let hierarchies;
let ui;

let activeConfiguration = CONFIGURATIONS['ontology'];

let runActiveConfiguration = function() {
  dataProvider = parallelHierarchies.dataProvider()
    .itemFile(activeConfiguration.itemsURI)
    .schemaFile(activeConfiguration.schemaURI)
    .itemID('ID')
    .itemValue('Value');

  hierarchies = parallelHierarchies()
    .width(WIDTH)
    .height(HEIGHT)
    .color(d3.scaleOrdinal().range(COLORS))
    .percentageBarSelection(d3.select('#percentageBars'))
    .dataProvider(dataProvider);

  ui = parallelHierarchies.ui()
    .hierarchies(hierarchies)
    .dropDownMenu(d3.select('nav > select'))
    .tooltip(d3.select('#tooltip'))
    .rulerLength(WIDTH - 20)
    .timestampSliders(d3.selectAll('#sliderV1,#sliderV2'))
    .swapDatasetButton(d3.select('button#swapDataset'))
    .title(d3.select('nav > h1'));

  ui.setCategoryInteraction('drag');

  hierarchies.ui(ui);

  d3.select('#rulers').call(ui);
  svg.call(hierarchies);
};


// EVENT LISTENERS OF UI COMPONENTS ////////////////////////////////////////////////////////////////

d3.select('#toggleGuiding').on('change', function() {
  d3.select('body').classed('lines', this.checked);
});
d3.select('#addRuler').on('click', () => ui.addRuler());
d3.selectAll('#fisheyeRadio,#draggingRadio').on('change', function() {
  ui.setCategoryInteraction(d3.event.target.value);
});
d3.select('#draggingRadio').node().checked = false;

d3.select('#toggleIntersectionMinimization').on('change', function() {
  hierarchies.useIntersectionMinimization(this.checked);
});
d3.select('#toggleIntersectionMinimization').node().checked = true;

d3.select('#toggleGreedyMinimization').on('change', function() {
  hierarchies.useGreedyMinimization(this.checked);
});
d3.select('#toggleGreedyMinimization').node().checked = false;

d3.select('button#swapDataset').on('click', function() {
  d3.select('#datasetModal').classed('hidden', false);
});

d3.select('#reset').on('click', runActiveConfiguration);

d3.select('#datasetModal').selectAll('li button').on('click', function() {
  const presetName = d3.event.target.value;
  activeConfiguration = CONFIGURATIONS[presetName];
  runActiveConfiguration();
  d3.select('#datasetModal').classed('hidden', true);
});

d3.select('#datasetModal div.hide').on('click', function() {
  d3.select('#datasetModal').classed('hidden', true);
});