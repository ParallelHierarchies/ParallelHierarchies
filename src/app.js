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

let mySchemaLoader = customSchemaLoader()
  .itemsFileInput(d3.select('#userItems').node())
  .onLoadEnd(function() {
    runActiveConfiguration(mySchemaLoader.schema, mySchemaLoader.itemList);
    d3.select('#datasetModal').classed('hidden', true);
  });

let activeConfiguration = CONFIGURATIONS['ontology'];

let runActiveConfiguration = function(presetSchema, presetItemList) {
  dataProvider = parallelHierarchies.dataProvider()
    .itemFile(activeConfiguration.itemsURI)
    .schemaFile(activeConfiguration.schemaURI)
    .itemID('ID')
    .itemValue('Value');

  if (presetSchema && presetItemList) {
    dataProvider.setSchemaFromJSON(mySchemaLoader.schema);
    dataProvider.setItemListFromCSV(mySchemaLoader.itemList);
  }

  hierarchies = parallelHierarchies()
    .width(window.innerWidth - 20)
    .height(window.innerHeight - 250)
    .color(d3.scaleOrdinal().range(COLORS))
    .percentageBarSelection(d3.select('#percentageBars'))
    .dataProvider(dataProvider);

  ui = parallelHierarchies.ui()
    .hierarchies(hierarchies)
    .dropDownMenu(d3.select('#dimensionPicker'))
    .tooltip(d3.select('#tooltip'))
    .rulerLength(WIDTH - 20)
    .timestampSliders(d3.selectAll('#sliderV1,#sliderV2'))
    .swapDatasetButton(d3.select('button#swapDataset'))
    .title(d3.select('nav h1'));

  ui.setCategoryInteraction('drag');

  hierarchies.ui(ui);

  d3.select('#rulers').call(ui);
  d3.select('#draggingRadio').node().checked = true;
  svg.call(hierarchies);
};

// EVENT LISTENERS OF UI COMPONENTS ////////////////////////////////////////////////////////////////

window.addEventListener('resize', () => {
  svg
    .attr('width', window.innerWidth - 20)
    .attr('height', window.innerHeight - 250);

  if (hierarchies != null)
    hierarchies
      .width(window.innerWidth - 20)
      .height(window.innerHeight - 250)
      .onResize()
});
d3.select('#toggleGuiding').on('change', function() {
  d3.select('body').classed('lines', this.checked);
});
d3.select('#addRuler').on('click', () => ui.addRuler());
d3.selectAll('#fisheyeRadio,#draggingRadio').on('change', function() {
  ui.setCategoryInteraction(d3.event.target.value);
});

d3.select('#toggleIntersectionMinimization').on('change', function() {
  hierarchies.useIntersectionMinimization(this.checked);
  d3.select('#toggleGreedyMinimization').node().disabled = !this.checked;
});
d3.select('#toggleIntersectionMinimization').node().checked = true;

d3.select('#toggleGreedyMinimization').on('change', function() {
  hierarchies.useGreedyMinimization(this.checked);
});

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

d3.select('#userSchemaLoad').on('click', () => {
  if (d3.select('#userItems').node().files.length === 0) return;

  mySchemaLoader.loadSchemaAndItems();
});
d3.select('#addUserHierarchyButton').on('click', function() {
  const label = d3.select('#userHierarchyLabel').node().value;
  const levels = d3.select('#userHierarchyLevels').node().value.split(',').map(s => s.trim());

  if (label.length === 0 || levels.length === 1) return;

  mySchemaLoader.addUserHierarchy(label, levels);

  let entry = d3.select('#userHierarchies').append('div');
  entry.append('div').attr('class', 'label').text(label);
  entry.append('div').attr('class', 'levels').text(levels.join(', '));

  d3.select('#userHierarchyLabel').node().value = '';
  d3.select('#userHierarchyLevels').node().value = '';
});