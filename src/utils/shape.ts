export function init(doc) {
  let d = {
    data: doc,
    operations: {},
    conflicts: {}
  };
  return d;
}

export function setValue(doc, path, value) {
  if (!doc) {
    return;
  }

  let node = doc;
  let ps = path.split(".");
  for (let i = 0; i < ps.length - 1; i++) {
    let t = null;
    if (Array.isArray(node)) {
      let n = node.findIndex(x => x.id === ps[i]);
      if (n >= 0) {
        t = node[n];
      }
    } else {
      t = node[ps[i]];
    }
    
    if (t) {
      node = t;
    } else {
      if (Array.isArray(node)) {
        t = {id: ps[i]};
        node.push(t);
        node = t;
      } else {
        node[ps[i]] = {};
        node = node[ps[i]];
      }
    }    
  }

  if (Array.isArray(node)) {
    let n = node.findIndex(x => x.id === ps[ps.length - 1]);
    if (n >= 0) {
      if (value === undefined) {
        node.splice(n, 1);
      } else {
        node[n] = Object.assign({}, node[n], value);
      }
    }
  } else {
    if (value === undefined) {
      delete node[ps[ps.length - 1]];
    } else {
      node[ps[ps.length - 1]] = value;
    }
  }
}

export function setPathValue(shapes, dt, path, value) {
  if (dt === "JSON") {
    setValue(shapes, path, JSON.parse(value));
  } else {
    setValue(shapes, path, value);
  }
}

// check if the operation with timestamp happens before operation
// with deps
function happensBefore(operations, timestamp, deps) {
  if (deps && deps.length > 0) {
    for (var i = 0; i < deps.length; i++) {
      if (lamportCompareImp(timestamp,deps[i].timestamp) === 0) {
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
  t.push({timestamp, cmd});

  if (t.length > 1) {
    t.sort(lamportCompare);
  }

  let w = t[t.length - 1].cmd;
  return w.isUndo ? w.old : w.value;
}

function jsonReducerImp(operation, doc) {
  let shapes = doc.data;
  let { cmds, timestamp, deps } = operation;
  let operations = doc.operations;

  // apply commands
  for (let j = 0; j < cmds.length; j++) {
    let cmd = cmds[j];
    let isUndo = cmd.isUndo;

    if (cmd.type === "add") {      
      if (isUndo) {
        let n = shapes.findIndex(function (s) {
          return s.id === cmd.shape.id;
        });
        if (n >= 0) {
          shapes.splice(n, 1);
        }
      } else {
        shapes.push(cmd.shape);
      }
    } else if (cmd.type === "remove") {
      if (isUndo) {
        shapes.push(cmd.shape);
      } else {
        let n = shapes.findIndex((s) => s.id === cmd.shape.id);
        if (n >= 0) {
          shapes.splice(n, 1);
        }
      }
    } else if (cmd.type === "property") {
      let val = getLastValue(doc, cmd, timestamp, deps);    
      setPathValue(shapes, cmd.dt, cmd.path, val);  
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

export function getHistory(doc) {
  if (!doc || !doc.initialized) {
    return [];
  }

  let operations = doc.operations;
  let keys = Object.keys(operations);
  let h = [];
  keys.forEach(t => {
    h.push(operations[t]);
  });

  if (h.length > 1) {
    h.sort(lamportCompare);
  }

  return h;
}

