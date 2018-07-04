const width = window.innerWidth - 20;
const height = window.innerHeight - 250;

const svg = d3.select('#parallelHierarchies')
  .attr('width', width)
  .attr('height', height);

const initialDimensions = ['INDUSTRY', 'OCCUP', 'LANGUAGE'];
const sampleColors = ['#77AADD', '#77CCCC', '#88CCAA', '#DDDD77', '#DDAA77', '#DD7788', '#CC99BB'];

const dataProvider = parallelHierarchies.dataProvider()
  .itemFile('./data/Census/census_items_10k.csv')
  .schemaFile('./data/Census/census_schema.json')
  .itemID('ID')
  .itemValue('Value');

const hierarchies = parallelHierarchies()
  .width(width)
  .height(height)
  .color(d3.scaleOrdinal().domain(initialDimensions).range(sampleColors))
  .initialDimensions(initialDimensions)
  .percentageBarSelection(d3.select('#percentageBars'))
  .dataProvider(dataProvider);

const ui = parallelHierarchies.ui()
  .hierarchies(hierarchies)
  .dropDownMenu(d3.select('nav > select'))
  .tooltip(d3.select('#tooltip'))
  .rulerLength(width - 20)
  .timestampSliders(d3.selectAll('#sliderV1,#sliderV2'))
  .title(d3.select('nav > h1'));

hierarchies.ui(ui);

d3.select('#toggleGuiding').on('change', function() {
  d3.select('body').classed('lines', this.checked);
});
d3.select('#addRuler').on('click', ui.addRuler);
d3.selectAll('#fisheyeRadio,#draggingRadio').on('change', function() {
  ui.setCategoryInteraction(d3.event.target.value);
});
d3.select('#draggingRadio').node().checked = false;
ui.setCategoryInteraction('drag');

d3.select('#toggleIntersectionMinimization').on('change', function() {
  hierarchies.useIntersectionMinimization(this.checked);
});
d3.select('#toggleIntersectionMinimization').node().checked = true;

d3.select('#toggleGreedyMinimization').on('change', function() {
  hierarchies.useGreedyMinimization(this.checked);
});
d3.select('#toggleGreedyMinimization').node().checked = false;


d3.select('#rulers').call(ui);

svg.call(hierarchies);