const getRangeSliderAgg = (sliderControl)=>{
    return {
        "size": 0,
        "aggs": {
            "maxAgg": {
                "max": {
                    "field": sliderControl.fieldName
                }
            },
            "minAgg": {
                "min": {
                    "field": sliderControl.fieldName
                }
            }
        },
        "_source": {
            "excludes": []
        },
        "stored_fields": [
            "*"
        ],
        "script_fields": {},        
        "query": {
            "bool": {
                "must": [],
                "filter": [],
                "should": [],
                "must_not": []
            }
        },
        "timeout": "30000ms"
    }
}

const getOptionListAgg = (olControl)=>{
    return {
        "timeout": "30000ms",
        "terminate_after": 100000,
        "size": 0,
        "aggs": {
            "termsAgg": {
                "terms": {
                    "order": {
                        "_count": "desc"
                    },
                    "field": olControl.fieldName
                }
            }
        },
        "_source": {
            "excludes": []
        },
        "stored_fields": [
            "*"
        ],
        "script_fields": {},
        "docvalue_fields": [
            {
                "field": "customer_birth_date",
                "format": "date_time"
            },
            {
                "field": "order_date",
                "format": "date_time"
            },
            {
                "field": "products.created_on",
                "format": "date_time"
            }
        ],
        "query": {
            "bool": {
                "must": [],
                "filter": [],
                "should": [],
                "must_not": []
            }
        }
    }
}


module.exports = {
    getControlDataRequest:function(visState){
        const controls = visState.params.controls;
        return controls.map((control)=>{
            if(control.type === 'range'){
                return getRangeSliderAgg(control);
            }
            else if(control.type === 'list'){
                return getOptionListAgg(control);
            }
        })
    },
    postRespProc:function(){

    }
}