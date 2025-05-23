/**
 * SCORM API Wrapper Class
 * Handles both SCORM 1.2 and 2004 versions
 */
export class SCORMSession {
  constructor(scormVersion = "1.2") {
    this.scormVersion = scormVersion;
    this.apiHandle = null;
    this.isScorm12 = scormVersion === "1.2";
    this.init();
  }

  init() {
    this.apiHandle = this.findAPIWindow();
    if (this.apiHandle) {
      console.log(`[SCORM] Found ${this.scormVersion} API handle`);
      this.apiInitialize();
    } else {
      console.error(`[SCORM] Could not find ${this.scormVersion} API`);
    }
  }

  findAPIWindow() {
    return this.isScorm12 ? this.findSCORM12API() : this.findSCORM2004API();
  }

  /**
   * Find the SCORM 1.2 API in current window, parent windows, or opener
   */
  findSCORM12API() {
    return this._findAPIInWindows("API");
  }

  /**
   * Find the SCORM 2004 API in current window, parent windows, or opener
   */
  findSCORM2004API() {
    return this._findAPIInWindows("API_1484_11");
  }

  /**
   * Helper method to search for API in window hierarchy
   * @param {string} apiName - Name of SCORM API object to find ("API" or "API_1484_11")
   * @returns {object|null} The API object or null if not found
   */
  _findAPIInWindows(apiName) {
    // First check in this window and its parents
    let api = this._searchWindowChain(window, apiName);
    if (api) return api;
    
    // Then check in opener window if it exists
    if (window.opener && window.opener !== window) {
      api = this._searchWindowChain(window.opener, apiName);
      if (api) {
        console.log(`[SCORM] Found ${apiName} in opener window`);
        return api;
      }
    }
    
    console.error(`[SCORM] Cannot find ${apiName}`);
    return null;
  }

  /**
   * Helper to search for API in a window and its parents
   */
  _searchWindowChain(startWindow, apiName) {
    let win = startWindow;
    let findAPITries = 0;
    
    while (win[apiName] == null && win.parent != null && win.parent != win) {
      findAPITries++;
      if (findAPITries > 10) {
        console.error(`[SCORM] Error finding ${apiName} - too deeply nested.`);
        return null;
      }
      win = win.parent;
    }
    
    if (win[apiName]) {
      console.log(`[SCORM] Found ${apiName}`);
      return win[apiName];
    }
    
    return null;
  }

  /**
   * Initialize the SCORM API
   */
  apiInitialize() {
    const methods = this.isScorm12 ? 
      { apiMethod: "LMSInitialize", globalMethod: "doLMSInitialize" } :
      { apiMethod: "Initialize", globalMethod: "doInitialize" };
    
    this._callSCORMMethod(methods.apiMethod, methods.globalMethod, [""], "initialization");
  }

  /**
   * Commit data to LMS
   */
  commit() {
    const methods = this.isScorm12 ?
      { apiMethod: "LMSCommit", globalMethod: "doLMSCommit" } :
      { apiMethod: "Commit", globalMethod: "doCommit" };
    
    this._callSCORMMethod(methods.apiMethod, methods.globalMethod, [""], "commit");
    console.log("[SCORM] Commit data");
  }

  /**
   * Get a value from SCORM
   */
  getValue(param) {
    console.log(`[SCORM] GetValue(${param})`);
    const methods = this.isScorm12 ?
      { apiMethod: "LMSGetValue", globalMethod: "doLMSGetValue" } :
      { apiMethod: "GetValue", globalMethod: "doGetValue" };
    
    return this._callSCORMMethod(methods.apiMethod, methods.globalMethod, [param], "get value") || "";
  }

  /**
   * Set a value in SCORM
   */
  setValue(param, value) {
    console.log(`[SCORM] SetValue(${param}, ${value})`);
    const methods = this.isScorm12 ?
      { apiMethod: "LMSSetValue", globalMethod: "doLMSSetValue" } :
      { apiMethod: "SetValue", globalMethod: "doSetValue" };
    
    return this._callSCORMMethod(methods.apiMethod, methods.globalMethod, [param, value], "set value") || false;
  }

  /**
   * Finish/terminate the SCORM session
   */
  finish() {
    const methods = this.isScorm12 ?
      { apiMethod: "LMSFinish", globalMethod: "doLMSFinish" } :
      { apiMethod: "Terminate", globalMethod: "doTerminate" };
    
    this._callSCORMMethod(methods.apiMethod, methods.globalMethod, [""], "finish/terminate");
    console.log("[SCORM] Session finished");
  }

  /**
   * Helper method to call SCORM methods with proper fallbacks and error handling
   * @param {string} apiMethod - The method name on the API object
   * @param {string} globalMethod - The global function name
   * @param {Array} args - Arguments to pass to the method
   * @param {string} operation - Description for logging
   * @returns {any} Result of the API call or undefined on error
   */
  _callSCORMMethod(apiMethod, globalMethod, args = [], operation = "operation") {
    // Try direct API call first
    if (this.apiHandle && typeof this.apiHandle[apiMethod] === "function") {
      try {
        return this.apiHandle[apiMethod](...args);
      } catch (err) {
        console.error(`[SCORM] Error during ${operation} via API:`, err);
      }
    }
    
    if (typeof window[globalMethod] === "function") {
      try {
        return window[globalMethod](...args);
      } catch (err) {
        console.error(`[SCORM] Error during ${operation} via global function:`, err);
      }
    }
    
    console.error(`[SCORM] Cannot perform ${operation} - method not found`);
    return undefined;
  }

  /**
   * Set the lesson status
   */
  statusLesson(value) {
    const param = this.isScorm12 ? "cmi.core.lesson_status" : "cmi.completion_status";
    this.setValue(param, value);
    this.commit();
  }

}