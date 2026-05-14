'use strict';

const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const expect = chai.expect;
chai.use(require('sinon-chai').default);

describe('ESClient', () => {

  let EnriseClient;
  let ElasticsearchClient;
  let logger;
  let agentkeepalive;

  beforeEach(() => {
    ElasticsearchClient = sinon.stub().returns({
      foo: 'bar'
    });
    logger = {
      debug: 'DEBUG',
      error: 'ERROR',
      warn: 'WARN',
      verbose: sinon.stub()
    };
    agentkeepalive = sinon.stub();

    EnriseClient = proxyquire('../index.js', {
      elasticsearch: {
        Client: ElasticsearchClient
      },
      agentkeepalive
    });
  });

  it('instantiates the elasticsearch client with default AgentKeepAlive', () => {
    const ESClient = new EnriseClient({
      my: 'settings'
    });
    expect(ESClient).to.deep.equal({
      foo: 'bar'
    });
    const settings = ElasticsearchClient.args[0][0];

    // Test the createNodeAgent and logger in a separate test
    expect(_.omit(settings, 'createNodeAgent')).to.deep.equal({
      log: undefined,
      my: 'settings'
    });
  });

  it('overwrites default configuration', () => {
    const config = {
      createNodeAgent: () => {},
      log: () => {},
      other: 'custom settings'
    };
    new EnriseClient(config); // eslint-disable-line no-new
    const args = ElasticsearchClient.args[0][0];

    expect(_.omit(args, 'log')).to.deep.equal({
      createNodeAgent: config.createNodeAgent,
      other: 'custom settings'
    });
    chai.assert.isFunction(args.log);
  });

  it('correctly calls the AgentKeepAlive', () => {
    new EnriseClient(); // eslint-disable-line no-new
    const connection = {
      makeAgentConfig: sinon.stub().returns('call agentkeepalive')
    };
    const config = {
      foo: 'bar'
    };
    // Call the createNodeAgent on the settings object passed to ElasticsearchClient
    ElasticsearchClient.args[0][0].createNodeAgent(connection, config);
    expect(connection.makeAgentConfig).to.have.been.calledWith({
      foo: 'bar'
    });
    expect(agentkeepalive).to.have.been.calledWith('call agentkeepalive');
  });

  it('correctly uses a logger, creates the LogConstructor and correctly formats trace information', () => {
    new EnriseClient({ // eslint-disable-line no-new
      log: logger
    });

    // Retrieve the LogConstructor the settings object passed to ElasticsearchClient
    const LogConstructor = ElasticsearchClient.args[0][0].log;
    chai.assert.isFunction(LogConstructor);

    const log = new LogConstructor(); // eslint-disable-line no-new

    chai.assert.isFunction(log.trace);
    chai.assert.isFunction(log.close);

    log.trace('POST', {url: 'local:9200', agent: 'elasticsearch'}, {request: 'body'}, {response: 'body'}, 200);

    expect(_.omit(log, 'trace', 'close')).to.deep.equal({
      info: 'DEBUG',
      debug: 'DEBUG',
      error: 'ERROR',
      warning: 'WARN'
    });

    expect(logger.verbose).to.have.been.calledWith({
      httpMethod: 'POST',
      requestUrl: {
        url: 'local:9200'
      },
      requestBody: {
        request: 'body'
      },
      responseBody: {
        response: 'body'
      },
      statusCode: 200
    });
  });

  it('does not modify the passed config object', () => {
    const config = {
      foo: 'bar',
      log: {}
    };

    new EnriseClient(config); // eslint-disable-line no-new
    expect(config).to.deep.equal({
      foo: 'bar',
      log: {}
    });
  });
});
