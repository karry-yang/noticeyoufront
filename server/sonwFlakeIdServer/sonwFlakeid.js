const SnowflakeId = require('snowflake-id').default;

const snowflake = new SnowflakeId({
    mid: 42,
    offset: (Date.now() - 1609459200000),
    returnNumber: false
});

module.exports = snowflake;