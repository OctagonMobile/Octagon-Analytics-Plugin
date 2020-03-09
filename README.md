# Octagon Analytics Plugin

This plugin of Kibana allows you to access Kibana meta objects (Saved Searches, Dashboard, Visualization) and extend customization APIs functionality. The main purpose is to display Kibana Dashboard in native mobile apps like on iPad.

Since Kibana have the Elasticsearch queries generated at the client end JavaScript, what we do here is migrating that part of logic at the NodeJS server end.

So far not all aggregation and metrics types are supported (Please check below for details).

And current supported version for Kibana is 6.5.4 - https://github.com/elastic/kibana/tree/v6.5.4 .

## Endpoints

### GET - Get all dashboards

```
/api/dashboard/list
```

### POST - Get visualization data by ID

```
/api/visualization-data
```

#### Params

- id
- filters
  The filters is an array defined like below:
  ```json
  [
    {
      "filterType": "range",
      "filterField": "length",
      "filterRangeFrom": "7500",
      "filterRangeTo": "8000"
    },
    {
      "filterType": "terms",
      "filterField": "length",
      "filterValue": "7500"
    }
  ]
  ```

  Currently supported filter types are:
  - Terms
  - Range
  - Date Histogram
  - Geohash Grid

- precision
- searchQueryPanel
- searchQueryDashboard

Current supported Metric aggregations :
- Count
- Avg
- Sum
- Median
- Min
- Max
- Cardinality
- Geo Centroid

Current supported Bucket aggregations :
- Date Histogram
- Histogram
- Range
- Terms
- Geo Hash

### POST - Get saved search data by ID

```
/api/saved-search-data
```

#### Params

- id
- pageSize
- pageNum
- searchQueryPanel
- searchQueryDashboard
- filters
  ```json
  [
    {
      "filterType": "range",
      "filterField": "length",
      "filterRangeFrom": "7500",
      "filterRangeTo": "8000"
    },
    {
      "filterType": "terms",
      "filterField": "length",
      "filterValue": "7500"
    }
  ]
  ```
    Currently supported filter types are:
  - Terms
  - Range
  - Date Histogram
  - Geohash Grid


### Image API Proxy

End points:

```
/api/imageproxy?esIndexName=INDEXNAME&customIdField=logstash_checksum&customIdValue=XXYYZZ&fieldnameField=file.filename&apitype=thumbnail
/api/imageproxy?esIndexName=INDEXNAME&customIdField=logstash_checksum&customIdValue=XXYYZZ&fieldnameField=file.filename&apitype=download
```

Configuration

```
octagon-analytics.imageProxy.enabled: true
octagon-analytics.imageProxy.imageApiServer: 'http://xxx.yyy.zzz.xxx:5513'
```

## Development

- Install plugin package dependencies: `yarn install`
- Run kibana (in its folder): `yarn start`

## Release

- Build a package: `yarn run build`


## Installation

- Get the package from your Build folder
- Install the plugin on your Kibana instance: `bin/kibana-plugin install <package name or URL>`

