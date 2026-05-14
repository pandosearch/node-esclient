'use strict';

const _ = require('lodash');
const elasticsearch = require('elasticsearch');
const AgentKeepAlive = require('agentkeepalive');

module.exports = function ESClient(config) {

  // Shallow clone since we're modifying config
  config = _.clone(config || {});

  const log = config.log;
  delete config.log;

  function LogConstructor() {
    // info tends to log 'Request complete' messages which we usually don't care about
    this.info = log.debug.bind(log);
    this.debug = log.debug.bind(log);
    this.error = log.error.bind(log);
    this.warning = log.warn.bind(log);

    // this can not be an arrow function because we require access to the arguments.
    this.trace = function () {
      const data = _.zipObject(['httpMethod', 'requestUrl', 'requestBody', 'responseBody', 'statusCode'], arguments);
      data.requestUrl = _.omit(data.requestUrl, 'agent');
      log.verbose(data);
    };
    this.close = () => {};
  }

  // Usage of AgentKeepalive via https://github.com/elastic/elasticsearch-js/issues/196
  // The default (node) http-agent is known to have connection-problems as described in the issue. These
  // problems can be either running out of connections or as we witnessed leaving http-connections dangling
  // after usage. Both are tied to connection-pooling, and not reusing sockets. As AgentKeepAlive helped
  // us fix the out-of-connections problems, it also seemed to help with dangling connections.
  config = _.merge({
    createNodeAgent(connection, conf) {
      return new AgentKeepAlive(connection.makeAgentConfig(conf));
    },
    log: log && LogConstructor
  }, config);

  return new elasticsearch.Client(config);
};
