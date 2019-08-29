import { shallow } from 'enzyme';
import 'jest-enzyme';
import * as React from 'react';

import { JSONSchema4 } from 'json-schema';
import { JsonSchemaViewerComponent, SchemaTree } from '../../components';
import { isSchemaViewerEmpty } from '../../utils/isSchemaViewerEmpty';
import { renderSchema } from '../../utils/renderSchema';

const { default: SchemaWorker } = require('../../workers/schema');

jest.mock('../../utils/isSchemaViewerEmpty');
jest.mock('../../workers/schema');
jest.mock('../../components/SchemaTree', () => ({
  SchemaTree() {
    return <div />;
  },
}));

const schema: JSONSchema4 = {
  properties: {
    data: {
      items: {
        $ref: '#/definitions/Gif',
      },
      type: 'array',
    },
    meta: {
      $ref: '#/definitions/Meta',
    },
    pagination: {
      $ref: '#/definitions/Pagination',
    },
  },
};

describe('JSON Schema Viewer component', () => {
  beforeEach(() => {
    (isSchemaViewerEmpty as jest.Mock).mockReturnValue(false);
    (SchemaWorker.prototype.postMessage as jest.Mock).mockClear();
    (SchemaWorker.prototype.addEventListener as jest.Mock).mockClear();
  });

  test('should render empty message if schema is empty', () => {
    (isSchemaViewerEmpty as jest.Mock).mockReturnValue(true);
    const wrapper = shallow(<JsonSchemaViewerComponent schema={{}} />);
    expect(isSchemaViewerEmpty).toHaveBeenCalledWith({});
    expect(wrapper.find(SchemaTree)).not.toExist();
  });

  test('should render SchemaView if schema is provided', () => {
    const wrapper = shallow(<JsonSchemaViewerComponent schema={schema as JSONSchema4} />);
    expect(isSchemaViewerEmpty).toHaveBeenCalledWith(schema);
    expect(wrapper.find(SchemaTree)).toExist();
  });

  test('should not perform full processing in a worker if provided schema has fewer nodes than maxRows', () => {
    const wrapper = shallow(<JsonSchemaViewerComponent schema={schema as JSONSchema4} maxRows={10} />);
    expect(SchemaWorker.prototype.postMessage).not.toHaveBeenCalled();
    expect(wrapper.instance()).toHaveProperty('treeStore.nodes.length', 4);
  });

  test('should perform full processing in a worker under all circumstances if mergeAllOf is not false and allOf combiner is found', () => {
    const schemaAllOf: JSONSchema4 = {
      allOf: [
        {
          properties: {
            Object1Property: {
              type: 'string',
              minLength: 1,
              'x-val': 'lol',
            },
          },
        },
      ],
    };

    shallow(<JsonSchemaViewerComponent schema={schemaAllOf} maxRows={10} />);

    expect(SchemaWorker.prototype.postMessage).toHaveBeenCalledWith({
      instanceId: expect.any(String),
      mergeAllOf: true,
      schema: schemaAllOf,
    });
  });

  test('should not perform full processing in a worker when an allOf combiner is found but mergeAllOf is false', () => {
    const schemaAllOf: JSONSchema4 = {
      allOf: [
        {
          properties: {
            Object1Property: {
              type: 'string',
              minLength: 1,
              'x-val': 'lol',
            },
          },
        },
      ],
    };

    shallow(<JsonSchemaViewerComponent schema={schemaAllOf} maxRows={10} mergeAllOf={false} />);

    expect(SchemaWorker.prototype.postMessage).not.toHaveBeenCalledWith();
  });

  test('should pre-render maxRows nodes and perform full processing in a worker if provided schema has more nodes than maxRows', () => {
    const wrapper = shallow(<JsonSchemaViewerComponent schema={schema as JSONSchema4} maxRows={1} />);
    expect(SchemaWorker.prototype.postMessage).toHaveBeenCalledWith({
      instanceId: expect.any(String),
      mergeAllOf: true,
      schema,
    });

    // pre-rendered
    expect(wrapper.instance()).toHaveProperty('treeStore.nodes', [
      {
        canHaveChildren: true,
        id: expect.any(String),
        level: 0,
        metadata: {
          id: expect.any(String),
          path: [],
          annotations: {},
          properties: {
            data: {
              items: {
                $ref: '#/definitions/Gif',
              },
              type: 'array',
            },
            meta: {
              $ref: '#/definitions/Meta',
            },
            pagination: {
              $ref: '#/definitions/Pagination',
            },
          },
          type: 'object',
          validations: {},
        },
        name: '',
      },
    ]);

    const nodes = Array.from(renderSchema(schema));

    SchemaWorker.prototype.addEventListener.mock.calls[0][1]({
      data: {
        instanceId: SchemaWorker.prototype.postMessage.mock.calls[0][0].instanceId,
        nodes,
      },
    });

    expect(wrapper.instance()).toHaveProperty('treeStore.nodes', nodes);
  });

  test('should not apply result of full processing in a worker if instance ids do not match', () => {
    const wrapper = shallow(<JsonSchemaViewerComponent schema={schema as JSONSchema4} maxRows={0} />);
    expect(SchemaWorker.prototype.postMessage).toHaveBeenCalledWith({
      instanceId: expect.any(String),
      mergeAllOf: true,
      schema,
    });

    const nodes = Array.from(renderSchema(schema));

    SchemaWorker.prototype.addEventListener.mock.calls[0][1]({
      data: {
        instanceId: 'foooo',
        nodes,
      },
    });

    expect(wrapper.instance()).toHaveProperty('treeStore.nodes', []);
  });
});
