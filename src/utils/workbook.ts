
export function uuid(name, index) {
    return name + '-' + index + '-' + Date.now();
}

export function getRowKeyToIndexes(doc) {
    let map = doc.rowsMap;
    let rowkeys = Object.keys(map);
    doc.rowKeyToIndexes = {};
    rowkeys.forEach(n => {
        doc.rowKeyToIndexes[map[n]] = parseInt(n); 
    });
    return doc.rowKeyToIndexes;
}

export function getColKeyToIndexes(doc) {
    let map = doc.colsMap;
    let colkeys = Object.keys(map);
    doc.colKeyToIndexes = {};
    colkeys.forEach(n => {
        doc.colKeyToIndexes[map[n]] = parseInt(n); 
    });
    return doc.colKeyToIndexes;
}

export function setValue(doc, path, value) {
    if (!doc) {
        return;
    }
    var node = doc;
    var ps = path.split('.');
    for (var i = 0; i < ps.length - 1; i++) {
        var t = node[ps[i]];
        if (!t) {
            node[ps[i]] = {};
        }
        node = node[ps[i]];
    }
    if (value === undefined) {
        delete node[ps[ps.length - 1]];
    }
    else {
        node[ps[ps.length - 1]] = value;
    }
}
export function setPathValue(doc, dt, path, value) {            
    if (dt === 'JSON') {
        setValue(doc.data, path, JSON.parse(value));
    }
    else {
        setValue(doc.data, path, value);
    }
}

// check if the operation with timestamp happens before operation
// with deps
function happensBefore(operations, timestamp, deps) {
    if (deps && deps.length > 0) {
        for (var i = 0; i < deps.length; i++) {
            if (lamportCompareImp(timestamp, deps[i].timestamp) === 0) {
                return true;
            }

            let op = operations[JSON.stringify(deps[i].timestamp)];
            if (op) {
                let b = happensBefore(operations, timestamp, op.deps);
                if (b) {
                    return true;
                }
            }
        }
    }
    return false;
}

function lamportCompareImp(timestamp1, timestamp2) {
    if (timestamp1.c < timestamp2.c || (timestamp1.c === timestamp2.c && timestamp1.u < timestamp2.u)) {
        return -1;
    } if (timestamp1.c === timestamp2.c && timestamp1.u === timestamp2.u) {
        return 0;
    } else {
        return 1;
    }
}

function lamportCompare(a, b) {
    return lamportCompareImp(a.timestamp, b.timestamp);
}

function getLastValue(doc, cmd, timestamp, deps) {
    let conflicts = doc.conflicts;
    let path = cmd.path;
    let t = conflicts && conflicts[path];
    if (t) {
        let i = 0;
        while (i < t.length) {
            let x = t[i];
            if (happensBefore(doc.operations, x.timestamp, deps)) {
                t.splice(i, 1);
            } else {
                i++;
            }
        }
    }

    if (!t) {
        t = conflicts[path] = [];
    }
    t.push({ timestamp, cmd });

    if (t.length > 1) {
        t.sort(lamportCompare);
    }

    let w = t[t.length - 1].cmd;
    return w.isUndo ? w.old : w.value;
}

export function copyDataRow(doc, rowkey, dataRows) {
    let colKeyToIndexes = getColKeyToIndexes(doc);
    let dataRow = dataRows[rowkey];

    let t = {};
    let colkeys = Object.keys(dataRow);
    colkeys.forEach(k => {
        if (colKeyToIndexes[k] >= 0) {
            t[k] = dataRow[k];
        }
    });

    doc.data[rowkey] = t;
}

export function copyDataCol(doc, colkey, dataCols) {
    let rowKeyToIndexes = getRowKeyToIndexes(doc);

    let rowkeys = Object.keys(dataCols);
    rowkeys.forEach(rowkey => {
        if (rowKeyToIndexes[rowkey] >= 0) {
            if (dataCols[rowkey] && dataCols[rowkey][colkey] !== undefined) {
                doc.data[rowkey][colkey] = dataCols[rowkey][colkey];
            }
        }
    });            
}

export function addRows(doc, row, count, rowkeys, dataRows?) {
    let rc = doc.rc;

    // find insert point                    
    let index = row - 1;
    let rowkey = rowkeys[index];

    let rowKeyToIndexes = getRowKeyToIndexes(doc);

    let n = rowKeyToIndexes[rowkey];
    while (isNaN(n) && index >= 0) {
        index--;
        rowkey = rowkeys[index];
        n = rowKeyToIndexes[rowkey];
    }

    if (isNaN(n)) {
        n = 0;
    } else {
        n = parseInt(n) + 1;
    }

    // shift the rows after the inserting point by count
    for (let i=rc-1; i>=n; i--) {
        doc.rowsMap[i+count] = doc.rowsMap[i];                        
        rowKeyToIndexes[doc.rowsMap[i]] = i+count;
        delete doc.rowsMap[i];
    }

    // add new row keys to the rows map
    // and add the data
    for (let i=0; i<count; i++) {
        rowkey = rowkeys[row + i];
        doc.rowsMap[n+i] = rowkey;
        rowKeyToIndexes[rowkey] = n+i;

        // data
        if (dataRows && dataRows[rowkey]) {
            copyDataRow(doc, rowkey, dataRows);
        }
    }
    doc.rc = doc.rc + count;
}

export function removeRows(doc, deletedRows) {
    let rowKeyToIndexes = getRowKeyToIndexes(doc);
    
    for (let i=0; i<deletedRows.length; i++) {
        // delete the row one by one
        
        let rowkey = deletedRows[i];                        
        let n = rowKeyToIndexes[rowkey];
        if (!isNaN(n)) {
            let rc = doc.rc;
            
            // shift the rows after the inserting point by 1
            n = parseInt(n);
            for (let j=n; j<rc; j++) {
                doc.rowsMap[j] = doc.rowsMap[j+1];
            }

            delete doc.rowsMap[rc-1];

            // data
            delete doc.data[rowkey];

            // delete the row key to index map for the deleted key
            delete rowKeyToIndexes[rowkey];

            // update row key to index map
            let ks = Object.keys(rowKeyToIndexes);
            for (let j=0; j<ks.length; j++) {
                let k = ks[j];
                if (rowKeyToIndexes[k] > n) {
                    rowKeyToIndexes[k] = rowKeyToIndexes[k] - 1;
                }
            }

            doc.rowKeyToIndexes = rowKeyToIndexes;
            
            doc.rc = rc - 1;
        }
    }
}

export function addColumns(doc, col, count, colkeys, dataCols?) {
    let cc = doc.cc;

    // find insert point                    
    let index = col - 1;
    let colkey = colkeys[index];

    let colKeyToIndexes = getColKeyToIndexes(doc);

    let n = colKeyToIndexes[colkey];
    while (isNaN(n) && index >= 0) {
        index--;
        colkey = colkeys[index];
        n = colKeyToIndexes[colkey];
    }

    if (isNaN(n)) {
        n = 0;
    } else {
        n = parseInt(n) + 1;
    }

    // shift the columns after the inserting point by count
    for (let i=cc-1; i>=n; i--) {
        doc.colsMap[i+count] = doc.colsMap[i];                        
        colKeyToIndexes[doc.colsMap[i]] = i+count;
        delete doc.colsMap[i];
    }

    // add new column keys to the columns map
    // and add the data
    for (let i=0; i<count; i++) {
        let colkey = colkeys[col + i];
        doc.colsMap[n+i] = colkey;
        colKeyToIndexes[colkey] = n+i;

        // data
        if (dataCols) {
            copyDataCol(doc, colkey, dataCols);
        }
    }
    doc.cc = doc.cc + count;
}

export function removeColumns(doc, deletedCols) {
    let colKeyToIndexes = getColKeyToIndexes(doc);
    
    for (let i=0; i<deletedCols.length; i++) {
        let colkey = deletedCols[i];                        
        let n = colKeyToIndexes[colkey];
        if (!isNaN(n)) {
            let cc = doc.cc;

            // shift the columns after the inserting point by 1
            n = parseInt(n);
            for (let j=n; j<cc; j++) {
                doc.colsMap[j] = doc.colsMap[j+1];
            }

            delete doc.colsMap[cc-1];

            // data
            let rks = Object.keys(doc.rowsMap);
            rks.forEach(k => {
                let rowkey = doc.rowsMap[k];
                if (doc.data[rowkey]) {
                    delete doc.data[rowkey][colkey];
                }
            });

            // delete column key to index map for the deleted column
            delete colKeyToIndexes[colkey];

            // update the column key to index map for columns after the inserting point
            let ks = Object.keys(colKeyToIndexes);
            for (let j=0; j<ks.length; j++) {
                let k = ks[j];
                if (colKeyToIndexes[k] > n) {
                    colKeyToIndexes[k] = colKeyToIndexes[k] - 1;
                }
            }

            doc.colKeyToIndexes = colKeyToIndexes;
            
            doc.cc = cc - 1;
        }
    }
}

export function jsonReducerImp(operation, doc) {
    let { cmds, timestamp, deps } = operation;
    let operations = doc.operations;

    // apply commands
    for (let j = 0; j < cmds.length; j++) {
        let cmd = cmds[j];
        let isUndo = cmd.isUndo;

        if (cmd.type === 'addRows') {
            // todo, conflict
            if (isUndo) {
                let deletedRows = [];
                for (let i=0; i<cmd.count; i++) {
                    deletedRows.push(cmd.rows[cmd.row + i]);
                }
                removeRows(doc, deletedRows);
            } else {
                addRows(doc, cmd.row, cmd.count, cmd.rows);
            }
        }
        else if (cmd.type === 'removeRows') {
            if (isUndo) {
                addRows(doc, cmd.row, cmd.count, cmd.rows, cmd.deletedDataRows);
            } else {   
                removeRows(doc, cmd.deletedRows);
            }
        }
        else if (cmd.type === 'addColumns') {
            // todo, conflict
            if (isUndo) {
                let deletedCols = [];
                for (let i=0; i<cmd.count; i++) {
                    deletedCols.push(cmd.cols[cmd.col + i]);
                }
                removeColumns(doc, deletedCols);
            } else {
                addColumns(doc, cmd.col, cmd.count, cmd.cols);
            }
        } else if (cmd.type === 'removeColumns') {
            if (isUndo) {
                addColumns(doc, cmd.col, cmd.count, cmd.cols, cmd.deletedDataCols);
            } else {   
                removeColumns(doc, cmd.deletedCols);
            }
        } else if (cmd.type === 'property') {
            let val = getLastValue(doc, cmd, timestamp, deps);
            setPathValue(doc, cmd.dt, cmd.path, val);
        }
    }

    operations[JSON.stringify(timestamp)] = operation;

    return doc;
}

export function jsonReducer(operation, doc) {
    if (!doc || !doc.initialized) {
      return doc;
    }
  
    // todo, queue -- check deps first
  
    doc = jsonReducerImp(operation, doc);
  
    return doc;
}
