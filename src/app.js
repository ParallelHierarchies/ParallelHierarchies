import ParalellHierarchiesModule from './parallelHierarchies/main';

const app = new ParalellHierarchiesModule();

const CONFIGURATIONS = {
  '1990 US Census (sample of 10k)': {
    schemaURI: './data/Census/census_schema_10k.json',
    itemURI: './data/Census/census_items_10k.csv',
    initialDimensions: ['SEX', 'OCCUP', 'INDUSTRY'],
  },
  '1990 US Census (sample of 100k)': {
    schemaURI: './data/Census/census_schema_100k.json',
    itemURI: './data/Census/census_items_100k.csv',
    initialDimensions: ['SEX', 'OCCUP', 'INDUSTRY'],
  },
  'Yeast Gene Ontology': {
    schemaURI: './data/Ontology/ontology_schema.json',
    itemURI: './data/Ontology/ontology_items.csv',
  },
  'Test Dataset': {
    schemaURI: './data/VersionControl/version_schema.json',
    itemURI: './data/VersionControl/version_items.csv',
  },
  'Pump Data': {
    schemaURI: './data/Pump/pump_schema.json',
    itemURI: './data/Pump/pump_items.csv',
  }
};

app.setConfigurations(CONFIGURATIONS);