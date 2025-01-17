import { Jinst } from "./Jinst";
import { ResultSetMetaData } from "./ResultSetMetaData";
import { TypeHandler } from "./TypeHandler";
import * as camalCase from "camelcase";

const java: any = Jinst.getInstance();

if (!Jinst.isJvmCreated()) {
    Jinst.addOption("-Xrs");
}

interface ToObjectConfig<T> {
    class?: new () => T;
    builder?: () => T;
    camelize?: boolean;
}

interface ToObjectResult<T> {
    labels: string[];
    rows: T[];
    types: string[];
}

export class ResultSet {
    private _rs;
    private _holdability: string[];
    private _types: string[];

    constructor(rs) {
        this._rs = rs;
        this._holdability = (() => {
            var h: string[] = [];
            h[
                java.getStaticFieldValue(
                    "java.sql.ResultSet",
                    "CLOSE_CURSORS_AT_COMMIT"
                )
            ] = "CLOSE_CURSORS_AT_COMMIT";
            h[
                java.getStaticFieldValue(
                    "java.sql.ResultSet",
                    "HOLD_CURSORS_OVER_COMMIT"
                )
            ] = "HOLD_CURSORS_OVER_COMMIT";
            return h;
        })();

        this._types = (() => {
            var typeNames: string[] = [];

            typeNames[java.getStaticFieldValue("java.sql.Types", "BIT")] =
                "Boolean";
            typeNames[java.getStaticFieldValue("java.sql.Types", "TINYINT")] =
                "Short";
            typeNames[java.getStaticFieldValue("java.sql.Types", "SMALLINT")] =
                "Short";
            typeNames[java.getStaticFieldValue("java.sql.Types", "INTEGER")] =
                "Int";
            typeNames[java.getStaticFieldValue("java.sql.Types", "BIGINT")] =
                "String";
            typeNames[java.getStaticFieldValue("java.sql.Types", "FLOAT")] =
                "Float";
            typeNames[java.getStaticFieldValue("java.sql.Types", "REAL")] =
                "Float";
            typeNames[java.getStaticFieldValue("java.sql.Types", "DOUBLE")] =
                "Double";
            typeNames[java.getStaticFieldValue("java.sql.Types", "NUMERIC")] =
                "BigDecimal";
            typeNames[java.getStaticFieldValue("java.sql.Types", "DECIMAL")] =
                "BigDecimal";
            typeNames[java.getStaticFieldValue("java.sql.Types", "CHAR")] =
                "String";
            typeNames[java.getStaticFieldValue("java.sql.Types", "VARCHAR")] =
                "String";
            typeNames[
                java.getStaticFieldValue("java.sql.Types", "LONGVARCHAR")
            ] = "String";
            typeNames[java.getStaticFieldValue("java.sql.Types", "DATE")] =
                "Date";
            typeNames[java.getStaticFieldValue("java.sql.Types", "TIME")] =
                "Time";
            typeNames[java.getStaticFieldValue("java.sql.Types", "TIMESTAMP")] =
                "Timestamp";
            typeNames[java.getStaticFieldValue("java.sql.Types", "BOOLEAN")] =
                "Boolean";
            typeNames[java.getStaticFieldValue("java.sql.Types", "NCHAR")] =
                "String";
            typeNames[java.getStaticFieldValue("java.sql.Types", "NVARCHAR")] =
                "String";
            typeNames[
                java.getStaticFieldValue("java.sql.Types", "LONGNVARCHAR")
            ] = "String";
            typeNames[java.getStaticFieldValue("java.sql.Types", "BINARY")] =
                "Bytes";
            typeNames[java.getStaticFieldValue("java.sql.Types", "VARBINARY")] =
                "Bytes";
            typeNames[
                java.getStaticFieldValue("java.sql.Types", "LONGVARBINARY")
            ] = "Bytes";
            typeNames[java.getStaticFieldValue("java.sql.Types", "BLOB")] =
                "Bytes";
            return typeNames;
        })();
    }

    async toObjArray<T>(param?: ToObjectConfig<T>): Promise<T[]> {
        let result: any = await this.toObject(param);
        return result.rows;
    }

    async toObject<T>(param?: ToObjectConfig<T>): Promise<ToObjectResult<T>> {
        let rs: any = await this.toObjectIter(param);

        let rowIter = rs.rows;
        let rows: any[] = [];
        let row = rowIter.next();

        while (!row.done) {
            rows.push(row.value);
            row = rowIter.next();
        }

        rs.rows = rows;
        return rs;
    }

    async toObjectIter<T>(param?: ToObjectConfig<T>): Promise<Object> {
        let self = this;
        let rsmd: ResultSetMetaData = await self.getMetaData();
        let colsmetadata: any[] = [];
        let colcount = await rsmd.getColumnCount();
        let builder =
            (param && param.builder) ||
            (param &&
                param.class &&
                (() => {
                    return new param!.class!();
                })) ||
            (() => new Object());
        let camelize = (param && param.camelize) || false;
        // Get some column metadata.
        await Promise.all(
            range({ start: 1, end: colcount + 1 }).map(async i => {
                let fieldName = await rsmd.getColumnLabel(i);
                if (camelize) {
                    fieldName = camalCase(fieldName);
                }
                colsmetadata.push({
                    label: fieldName,
                    type: await rsmd.getColumnType(i)
                });
            })
        );

        return {
            labels: colsmetadata.map(c => c.label),
            types: colsmetadata.map(c => self._types[c.type]),
            rows: {
                next: function() {
                    let nextRow;
                    try {
                        nextRow = self._rs.nextSync(); // this row can lead to Java RuntimeException - sould be cathced.
                    } catch (error) {
                        throw error;
                    }
                    if (!nextRow) {
                        return {
                            done: true
                        };
                    }
                    let result = builder();

                    range({
                        start: 1,
                        end: colcount + 1
                    }).forEach(i => {
                        // loop through each column
                        let cmd = colsmetadata[i - 1];
                        let type = self._types[cmd.type] || "String";
                        let getter = "get" + type + "Sync";

                        if (
                            type === "Date" ||
                            type === "Time" ||
                            type === "Timestamp"
                        ) {
                            let dateVal = self._rs[getter](i);
                            result[cmd.label] = dateVal
                                ? TypeHandler.fromJavaDate(dateVal)
                                : null;
                        } else if (type == "BigDecimal") {
                            let val = self._rs[getter](i);
                            result[cmd.label] = val
                                ? TypeHandler.fromJavaBigDecimal(val)
                                : null;
                        } else {
                            // If the column is an integer and is null, set result to null and continue
                            if (
                                type === "Int" &&
                                self._rs.getObjectSync(i) !== null
                            ) {
                                result[cmd.label] = null;
                                return;
                            }
                            result[cmd.label] = self._rs[getter](i);
                        }
                    });
                    return {
                        value: result,
                        done: false
                    };
                }
            }
        };
    }

    async close() {
        await this._rs.close$();
    }

    async getMetaData(): Promise<ResultSetMetaData> {
        let rsmd = await this._rs.getMetaData$();
        return new ResultSetMetaData(rsmd);
    }
}

function range({ start = 0, end }): number[] {
    let arr: number[] = [];
    for (let i = start; i < end; i++) {
        arr.push(i);
    }
    return arr;
}
