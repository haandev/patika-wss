export const merge = (defaultObj, obj) => {
  if (typeof obj === "undefined") {
    /** if source object is undefined, load defaults */
    return defaultObj;
  }
  if (typeof obj !== typeof defaultObj) {
    /** if source objects type changed, it means changes are major, load source object */
    return obj;
  }
  if (obj.constructor === Array) {
    /** if both of them an array, merge arrays */
    return [...obj, ...defaultObj];
  }
  if (typeof obj === "object") {
    /** if objects are not array and they are objects, ( {etc..} , {etc..}) look up recursively */
    const keys = [...Object.keys(defaultObj), ...Object.keys(obj)];
    return keys.reduce((store, currentKey) => {
      store[currentKey] = merge(defaultObj[currentKey], obj[currentKey]);
      return store;
    }, {});
  }

  return obj;
};
