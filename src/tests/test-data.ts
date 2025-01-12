export const sampleData = [
  {
    query:
      'data = from(bucket: "errors")\n|> range(start: 2024-12-30T04:00:33.0000000Z, stop: 2024-12-30T04:06:43.8046639Z)\n|> filter(fn: (r) => r["_measurement"] == "span")\n|> filter(fn: (r) => r["_field"] == "Duration" or\nr["_field"] == "ExclusiveDuration")\n|> filter(fn: (r) => r.SpanName == "Microsoft.AspNetCore.Hosting.HttpRequestIn")\n|> filter(fn: (r) => r.InstrumentationLibrary == "Microsoft.AspNetCore")\n|> filter(fn: (r) => r.Environment == "LAC-DIGMA#ID#D7CF83DD-8B04-44DF-860D-7363FB6B1906")\n|> group(columns: ["_field", "FlowHash"])\ndata\n|> aggregateWindow(every: 1s, fn: mean, createEmpty: false)\n|> keep(columns: ["_time", "_field", "_value", "FlowHash"])\n|> yield(name: "durations")\ndata\n|> filter(fn: (r) => r["_field"] == "ExclusiveDuration")\n|> aggregateWindow(every: 1s, fn: count, createEmpty: false)\n|> keep(columns: ["_time", "_value", "FlowHash"])\n|> yield(name: "concurrences")',
    ormFramework: "InfluxQL",
    instrumentationLibrary: "InfluxClient",
  },
  {
    query:
      "with inputs as (\nselect *\nFROM (VALUES (@AccountId_0, @Environment_0, @SpanCodeObjectId_0, @TimeWindow_0, @Duration_0, @CreatedAt_0, @DbStatement_0, @Count_0, @LastCommitId_0, @UpdatesAt_0, @DbName_0, @trace_bins_0::jsonb)) as inputs(account_id, environment, span_code_object_id, window_hour, duration, created_at, db_statement, count, last_commit_id, updated_at, db_name, trace_bins)\n),\nupdated as (\nINSERT INTO db_span_durations_hourly as dsdh(account_id, environment, span_code_object_id, window_hour, duration, created_at, db_statement, count, last_commit_id, updated_at, db_name, trace_bins)\nselect *\nFROM inputs\nON CONFLICT ON CONSTRAINT db_span_durations_hourly_key\nDO UPDATE SET\nduration        = dsdh.duration + excluded.duration,\ncount           = dsdh.count + excluded.count,\nlast_commit_id  = excluded.last_commit_id,\ndb_name         = excluded.db_name,\nupdated_at      = excluded.updated_at,\n--------\n-- check if a bin with the same 'lowerBound' value is already exists\n-- by stripping out ('#-' operator) the 'traceId' and the 'rand' from the bin,\n-- and the existing json contains ('@>' operator) the bin with 'lowerBound' field with its' value\n--------\ntrace_bins      = case when dsdh.trace_bins @> (excluded.trace_bins #- '{0,traceId}' #- '{0,rand}') then dsdh.trace_bins\nelse dsdh.trace_bins || excluded.trace_bins end\nRETURNING account_id, environment, span_code_object_id, window_hour, trace_bins\n)\nselect inputs.trace_bins->0->>'traceId'\nfrom inputs\njoin updated USING (account_id, environment, span_code_object_id, window_hour)\nwhere updated.trace_bins @> inputs.trace_bins",
    ormFramework: "EntityFramework",
    instrumentationLibrary: "Npgsql",
  },
  {
    query:
      "UPDATE span_usage_stats\nSET last_seen = inputs.last_seen\nFROM (VALUES (@AccountId_0, @Environment_0, @FlowHash_0, @LastSeen_0)) AS inputs(account_id, environment, flow_hash, last_seen)\nWHERE span_usage_stats.account_id = inputs.account_id\nAND span_usage_stats.environment = inputs.environment\nAND span_usage_stats.flow_hash = inputs.flow_hash",
    ormFramework: "EntityFramework",
    instrumentationLibrary: "Npgsql",
  },
  {
    query:
      "SELECT DISTINCT ON (endpoint_span.uid)\ne.route AS Route,\ne.service AS Service,\nendpoint_span.span AS SpanName,\nendpoint_span.environment AS Environment,\nendpoint_span.instrumentation_library AS InstrumentationLibrary,\nendpoint_span.display_name AS DisplayName,\nendpoint_span.kind AS Kind,\nendpoint_span.code_object_id AS CodeObjectId,\nendpoint_span.span_code_object_id AS SpanCodeObjectId,\nspan_descendants.descendant_flow_hash AS FlowHash,\nspan_flows_meta.latest_trace_id AS SampleTraceId,\nspan_flows_meta.updated_at AS LastUpdatedAt,\nendpoint_concurrency.data AS JsonData\nFROM endpoints e\nJOIN spans AS endpoint_span ON\nendpoint_span.span_code_object_id = e.span_code_object_id AND\nendpoint_span.environment = e.environment  AND\nendpoint_span.account_id = e.account_id\nJOIN span_descendants ON\nspan_descendants.span_uid = endpoint_span.uid\nJOIN spans AS descendant_span ON\ndescendant_span.uid = span_descendants.descendant_span_uid  AND\ndescendant_span.span = @spanName AND\ndescendant_span.instrumentation_library = @instrumentationLibrary AND\ndescendant_span.environment = @environment AND\ndescendant_span.account_id = @accountId\nJOIN span_concurrency AS endpoint_concurrency ON\nendpoint_concurrency.span_uid = endpoint_span.uid AND\nendpoint_concurrency.is_scale_badly = TRUE AND\nendpoint_concurrency.is_exclusive = FALSE AND\nendpoint_concurrency.flow_hash = ''\nJOIN span_concurrency AS descendant_concurrency ON\ndescendant_concurrency.span_uid = descendant_span.uid  AND\ndescendant_concurrency.flow_hash = span_descendants.descendant_flow_hash AND\ndescendant_concurrency.is_scale_badly = TRUE AND\ndescendant_concurrency.is_exclusive = FALSE AND\ndescendant_concurrency.increase_from_base > endpoint_concurrency.increase_from_base/3\nleft JOIN span_flows_meta ON\nspan_flows_meta.account_id = e.account_id AND\nspan_flows_meta.environment = e.environment AND\nspan_flows_meta.flow_hash = descendant_concurrency.flow_hash AND\nspan_flows_meta.latest_span_timestamp > @since\nORDER BY endpoint_span.uid, endpoint_concurrency.increase_from_base DESC",
    ormFramework: "Raw",
    instrumentationLibrary: "Npgsql",
  },
  {
    query:
      "SELECT\nsp.account_id               AS AccountId,\nsp.environment              AS Environment,\nsp.instrumentation_library  AS InstrumentationLibrary,\nsp.span                     AS Span,\nsp.latest_span_timestamp    AS LatestSpanTimestamp,\nsp.metadata_hash            AS MetadataHash\nFROM spans AS sp\nWHERE metadata_hash = ANY(@hashes)",
    ormFramework: "Raw",
    instrumentationLibrary: "Npgsql",
  },
  {
    query:
      "select environment as Id, max(latest_span_timestamp) as LastActivity\nfrom spans\nwhere latest_span_timestamp >= @fromTime\nand account_id = @accountId\ngroup by environment",
    ormFramework: "Raw",
    instrumentationLibrary: "Npgsql",
  },
  {
    query:
      'ids = ["40FDCB4C689C8CA481845C31203A0A"]\ntotal = from(bucket: "errors")\n|> range(start: 2024-12-20T00:00:00.0000000Z, stop: 2025-01-03T00:00:00.0000000Z)\n|> filter(fn: (r) => r._measurement == "span" and\nr._field == "Occurrences" and\nr.Environment == "LAC-DIGMA#ID#D7CF83DD-8B04-44DF-860D-7363FB6B1906")\n|> group(columns: ["ServiceName", "SpanName", "InstrumentationLibrary"])\n|> sum()\n|> keep(columns: ["ServiceName", "SpanName", "InstrumentationLibrary", "_value"])\n|> rename(columns: {_value: "Total"})\n//|> yield(name: "all_spans")\nerrored = from(bucket: "errors")\n|> range(start: 2024-12-20T00:00:00.0000000Z, stop: 2025-01-03T00:00:00.0000000Z)\n|> filter(fn: (r) => r._measurement == "error_span" and\nr._field == "Occurrences" and\nr.Environment == "LAC-DIGMA#ID#D7CF83DD-8B04-44DF-860D-7363FB6B1906"\nand contains(value: r.ErrorFlowId, set: ids))\n|> group(columns: ["ErrorFlowId", "ServiceName", "SpanName", "InstrumentationLibrary"])\n|> sum()\n|> keep(columns: ["ErrorFlowId", "ServiceName", "SpanName", "InstrumentationLibrary", "_value"])\n|> rename(columns: {_value: "Errored"})\n//|> yield(name: "errored")\njoined = join(tables: {d1: total, d2: errored}, on: ["ServiceName", "SpanName", "InstrumentationLibrary"])\n|> yield(name: "joined")',
    ormFramework: "InfluxQL",
    instrumentationLibrary: "InfluxClient",
  },
  {
    query:
      "select distinct span_code_object_id\nfrom span_usage_stats\nwhere account_id = @accountId\nand environment = @environment",
    ormFramework: "Raw",
    instrumentationLibrary: "Npgsql",
  },
  {
    query:
      'ids = ["35A9335D8B420D625D3E685C6F47A5"]\ntotal = from(bucket: "errors")\n|> range(start: 2024-12-20T00:00:00.0000000Z, stop: 2025-01-03T00:00:00.0000000Z)\n|> filter(fn: (r) => r._measurement == "span" and\nr._field == "Occurrences" and\nr.Environment == "PETCLINIC-DIGMA#ID#EF967EF9-589A-4711-B672-5EAADEC8C8CC")\n|> group(columns: ["ServiceName", "SpanName", "InstrumentationLibrary"])\n|> sum()\n|> keep(columns: ["ServiceName", "SpanName", "InstrumentationLibrary", "_value"])\n|> rename(columns: {_value: "Total"})\n//|> yield(name: "all_spans")\nerrored = from(bucket: "errors")\n|> range(start: 2024-12-20T00:00:00.0000000Z, stop: 2025-01-03T00:00:00.0000000Z)\n|> filter(fn: (r) => r._measurement == "error_span" and\nr._field == "Occurrences" and\nr.Environment == "PETCLINIC-DIGMA#ID#EF967EF9-589A-4711-B672-5EAADEC8C8CC"\nand contains(value: r.ErrorFlowId, set: ids))\n|> group(columns: ["ErrorFlowId", "ServiceName", "SpanName", "InstrumentationLibrary"])\n|> sum()\n|> keep(columns: ["ErrorFlowId", "ServiceName", "SpanName", "InstrumentationLibrary", "_value"])\n|> rename(columns: {_value: "Errored"})\n//|> yield(name: "errored")\njoined = join(tables: {d1: total, d2: errored}, on: ["ServiceName", "SpanName", "InstrumentationLibrary"])\n|> yield(name: "joined")',
    ormFramework: "InfluxQL",
    instrumentationLibrary: "InfluxClient",
  },
  {
    query:
      'data = from(bucket: "errors")\n|> range(start: 2024-12-30T13:45:31.0000000Z, stop: 2024-12-30T13:51:31.5715911Z)\n|> filter(fn: (r) => r["_measurement"] == "span")\n|> filter(fn: (r) => r["_field"] == "Duration" or\nr["_field"] == "ExclusiveDuration")\n|> filter(fn: (r) => r.SpanName == "monitor")\n|> filter(fn: (r) => r.InstrumentationLibrary == "MonitorService")\n|> filter(fn: (r) => r.Environment == "PETCLINIC-DIGMA#ID#EF967EF9-589A-4711-B672-5EAADEC8C8CC")\n|> group(columns: ["_field", "FlowHash"])\ndata\n|> aggregateWindow(every: 1s, fn: mean, createEmpty: false)\n|> keep(columns: ["_time", "_field", "_value", "FlowHash"])\n|> yield(name: "durations")\ndata\n|> filter(fn: (r) => r["_field"] == "ExclusiveDuration")\n|> aggregateWindow(every: 1s, fn: count, createEmpty: false)\n|> keep(columns: ["_time", "_value", "FlowHash"])\n|> yield(name: "concurrences")',
    ormFramework: "InfluxQL",
    instrumentationLibrary: "InfluxClient",
  },
  {
    query:
      "INSERT INTO endpoint_breakdown_histogram_bins\n(timestamp, account_id, environment, service_name, span_code_object_id, has_async_spans, bin_number, bin_value, bin_metadata)\nVALUES (@Timestamp_0, @AccountId_0, @Environment_0, @Service_0, @SpanCodeObjectId_0, @HasAsyncSpans_0, @BinIndex_0, @BinValue_0, CAST(@BinMetadataJson_0 AS JSON))\nON CONFLICT ON CONSTRAINT endpoint_breakdown_histogram_bins_key\nDO UPDATE SET bin_metadata = CAST(excluded.bin_metadata AS JSON), bin_value = endpoint_breakdown_histogram_bins.bin_value + excluded.bin_value",
    ormFramework: "EntityFramework",
    instrumentationLibrary: "Npgsql",
  },
  {
    query:
      "UPDATE span_usage_stats\nSET last_seen = inputs.last_seen\nFROM (VALUES (@AccountId_0, @Environment_0, @FlowHash_0, @LastSeen_0),\n(@AccountId_1, @Environment_1, @FlowHash_1, @LastSeen_1),\n(@AccountId_2, @Environment_2, @FlowHash_2, @LastSeen_2),\n(@AccountId_3, @Environment_3, @FlowHash_3, @LastSeen_3),\n(@AccountId_4, @Environment_4, @FlowHash_4, @LastSeen_4),\n(@AccountId_5, @Environment_5, @FlowHash_5, @LastSeen_5),\n(@AccountId_6, @Environment_6, @FlowHash_6, @LastSeen_6),\n(@AccountId_7, @Environment_7, @FlowHash_7, @LastSeen_7),\n(@AccountId_8, @Environment_8, @FlowHash_8, @LastSeen_8),\n(@AccountId_9, @Environment_9, @FlowHash_9, @LastSeen_9),\n(@AccountId_10, @Environment_10, @FlowHash_10, @LastSeen_10),\n(@AccountId_11, @Environment_11, @FlowHash_11, @LastSeen_11),\n(@AccountId_12, @Environment_12, @FlowHash_12, @LastSeen_12),\n(@AccountId_13, @Environment_13, @FlowHash_13, @LastSeen_13)) AS inputs(account_id, environment, flow_hash, last_seen)\nWHERE span_usage_stats.account_id = inputs.account_id\nAND span_usage_stats.environment = inputs.environment\nAND span_usage_stats.flow_hash = inputs.flow_hash",
    ormFramework: "EntityFramework",
    instrumentationLibrary: "Npgsql",
  },
  {
    query:
      "select environment as Id, max(latest_span_timestamp) as LastActivity\nfrom spans\nwhere latest_span_timestamp >= @fromTime\nand account_id = @accountId\ngroup by environment",
    ormFramework: "Raw",
    instrumentationLibrary: "Npgsql",
  },
  {
    query:
      "SELECT account_id      AS AccountId,\nenvironment     AS Environment,\nid              AS Id,\nlatest_trace_id AS LatestTraceId,\njson_data       AS JsonData\nFROM   error_flows_meta\nWHERE  account_id = @accountId\nAND  environment = @environment\nAND  id = ANY(@errorFlowIds)",
    ormFramework: "Raw",
    instrumentationLibrary: "Npgsql",
  },
  {
    query:
      "SELECT account_id AS AccountId,\nenvironment AS Environment,\ntrace_scope_hash AS TraceScopeHash,\nlatest_trace_timestamp AS LatestTraceTimestamp,\nlatest_trace_id AS  LatestTraceId\nFROM   trace_scopes\nWHERE  account_id = @accountId\nAND  environment = @environment\nAND  trace_scope_hash = @trace_scope_hash",
    ormFramework: "Raw",
    instrumentationLibrary: "Npgsql",
  },
];
