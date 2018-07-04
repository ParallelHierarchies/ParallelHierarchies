const converter = require('../converter');
const hierarchyParser = require('../hierarchy_parser');

const targetFile = './data/Census/census_items_400k.csv';

const files = [
  './data/Census/census_400k_random.csv'
];

const hierarchies = [
  './data/Census/ancestry_hierarchy.csv',
  './data/Census/hispanic_hierarchy.csv',
  './data/Census/industry_hierarchy.csv',
  './data/Census/language_hierarchy.csv',
  './data/Census/occupation_hierarchy.csv',
  './data/Census/pob_hierarchy.csv',
  './data/Census/race_hierarchy.csv'
];

const dimensions = ['ANCESTRY', 'HISPANIC', 'INDUSTRY', 'LANGUAGE', 'OCCUP', 'POB', 'RACE'];
const dimensionHierarchies = [
  { 'label': 'ANCESTRY 1', levels: [] },
  { 'label': 'ANCESTRY 2', levels: [] },
  { 'label': 'HISPANIC', levels: [] },
  { 'label': 'INDUSTRY', levels: [] },
  { 'label': 'LANGUAGE', levels: [] },
  { 'label': 'RACE', levels: [] },
  { 'label': 'OCCUP', levels: [] },
  { 'label': 'POB', levels: [] }
];

const exclude = ['PWGT1', 'RPINCOME'];

hierarchyParser
  .sourceFiles(hierarchies)
  .dimensions(dimensions)
  .run(runConverter);

function runConverter() {
  let deepestLevels = hierarchyParser.deepestLevels();

  for (let dh = 0; dh < dimensionHierarchies.length; dh++) {
    let hierarchy = dimensionHierarchies[dh];
    let dimension = hierarchy.label;
    let label = hierarchy.label;

    if (hierarchy.label === 'ANCESTRY 1') {
      dimension = 'ANCSTRY1';
      label = 'ANCESTRY';
    } else if (hierarchy.label === 'ANCESTRY 2') {
      dimension = 'ANCSTRY2';
      label = 'ANCESTRY';
    } else if (hierarchy.label === 'LANGUAGE') {
      dimension = 'LANG2';
      hierarchy.levels.push('LANG');
    }

    for (let i = 0; i < deepestLevels[label] + 1; i++) {
      hierarchy.levels.push(dimension + i);
    }
  }

  dimensionHierarchies.push({'label': 'AGE', 'levels': ['AGE0', 'AGE1']});

  converter
    .title('Census Data')
    .unit('individuals')
    .delimiter(';')
    .title('US Census Data (1990) Data Set')
    .excludeDimensions(exclude)
    .itemTransform(itemTransform)
    .sourceFiles(files)
    // .value(incomeValue)
    .dimension_hierarchy(dimensionHierarchies)
    .outputFile(targetFile)
    .run();
}

function incomeValue(d) {
  return +d['RPINCOME'];
}

function itemTransform(item) {
  let voidDimensions = [];

  item['AGE0'] = parseInt((+item['AGE']) / 10) * 10 + '+';
  item['AGE1'] = +item['AGE'];
  voidDimensions.push('AGE');

  item['SEX'] = item['SEX'] == 0 ? 'Male' : 'Female';
  item['LANG'] = item['LANG1'] == 0
    ? 'NA (less than 5 years old)'
    : item['LANG1'] == 1
      ? 'Speaks other language'
      : 'Speaks only English';

  delete item['LANG1'];

  for (let dim in item) {

    let trace = [];
    let dimension = dim;

    if (dim === 'ANCSTRY1' || dim === 'ANCSTRY2') dimension = 'ANCESTRY';
    else if (dim === 'LANG2') dimension = 'LANGUAGE';
    else if (dimensions.indexOf(dim) === -1) continue;

    trace = hierarchyParser.trace(parseInt(item[dim]), dimension);

    if (trace.length > 0) voidDimensions.push(dim);

    for (let t = 0; t < trace.length; t++) {
      item[dim + t] = trace[t];
    }

  }

  for (let vd = 0; vd < voidDimensions.length; vd++) {
    delete item[voidDimensions[vd]];
  }

  return item;
}
