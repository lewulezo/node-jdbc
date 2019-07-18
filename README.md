# node-jdbc

JDBC API Wrapper for node.js & typescript. Fork from https://github.com/CraZySacX/node-jdbc. Rewrite in typescript.

## Latest Version

-   **0.0.1**

## Supported Java Versions

-   1.7
-   1.8

[node-java](https://github.com/joeferner/node-java) has experiemental support for 1.8, and if you are brave you can
compile it with such. All the tests work out of the box on a 1.8 JVM, but I've only wrapped 1.7 functions.

Note that Java 9 is not currently supported. When node-java supports Java 9, I will look into implementing any
new Java 9 API changes (if any).

## Usage

-   **Connection Pooling**

Everyone gets a pool now. By default with no extra configuration, the pool
is created with one connection that can be reserved/released. Currently, the
pool is configured with two options: `minPoolSize` and `maxPoolSize`. If
`minPoolSize` is set, when the pool is initialized, `minPoolSize` connections
will be created. If `maxPoolSize` is set (the default value is `minPoolSize`),
and you try and reserve a connection and there aren't any available, the pool
will be grown. This can happen until `maxPoolSize` connections have been
reserved. The pool should be initialized after configuration is set with the
`initialize()` function. JDBC connections can then be acquired with the
`getConnection()` function and returned to the pool with the `returnConnection()` function.
Below is the sample code for the pool that demonstrates this behavior.

-   **Automatically Closing Idle Connections**

If you pass a **maxIdle** property in the config for a new connection pool,
`pool.getConnection()` will close stale connections, and will return a sufficiently fresh connection, or a new connection. **maxIdle** can be number representing the maximum number of milliseconds since a connection was last used, that a connection is still considered alive (without making an extra call to the database to check that the connection is valid). If **maxIdle** is a falsy value or is absent from the config, this feature does not come into effect. This feature is useful, when connections are automatically closed from the server side after a certain period of time, and when it is not appropriate to use the connection keepalive feature.

-   **Fully Wrapped Connection API**

The Java Connection API has almost been completely wrapped.

```typescript
await conn.setAutoCommit(false);
```

-   **ResultSet processing separated from statement execution**

ResultSet processing has been separated from statement execution to allow for
more flexibility. The ResultSet returned from executing a select query can
still be processed into an object array using the `toObjArray()` function on the
resultset object.

```typescript
// Select statement example.
let statement = await conn.createStatement();
let resultSet = await statement.executeQuery("SELECT * FROM blah;");
// Convert the result set to an object array.
let results = await resultset.toObjArray();
if (results.length > 0) {
    console.log("ID: " + results[0].ID);
}
```

Some mininal examples are given below

```typescript
import { JDBC, JdbcPoolConfig } from "jdbc";

const config: JdbcPoolConfig = {
    url: "jdbc:hsqldb:hsql://localhost/xdb",
    user: "SA",
    password: "",
    minPoolSize: 2,
    maxPoolSize: 3
};

async function test() {
    let pool = new JDBC(config);
    await pool.initialize();
    let conn = await pool.getConnection();
    console.log(pool.status);
    try {
        let statement = await conn.prepareStatement(`
        SELECT * FROM USERS WHERE USER_ID = ? AND AGE > ?
      `);
        await statement.setLong(1, 10000001);
        await statement.setInt(2, 25);
        let resultSet = await statement.executeQuery();
        let rows = await resultSet.toObjArray({
            class: User,
            camelize: true
        });
        console.log(rows.length);
        if (rows.length > 0) {
            console.log(rows[0].toString());
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.returnConnection(conn);
    }
}

enum Gender {
    MALE = 1,
    FEMAIL = 2
}

class User {
    userId: number;
    userName: string;
    age: number;
    birthday: Date;
    gender: Gender;

    toString(): string {
        return JSON.stringify(this);
    }
}

test();
```
