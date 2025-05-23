import { SCORMSession } from "../sessions/scormSession.js";

export class SCORMManager {
  constructor(scormVersion, lastViewedPageVariable) {
    this.scormVersion = scormVersion;
    this.scormSession = null;
    this.isConnected = false;
    this.lastViewedPageVariable = lastViewedPageVariable;
    this.hasCompletedCourse = false;
    this.hasPassedCourse = false;
    this.is2004 = scormVersion === "2004";
  }

  // ===== Initialization =====
  initialize() {
    this.scormSession = new SCORMSession(this.scormVersion);
    this.isConnected = !!(this.scormSession && this.scormSession.apiHandle);
    console.log(`[SCORMManager] LMS Connection: ${this.isConnected ? "Connected" : "Not connected"}`);

    if (this.isConnected) {
      this._checkExistingStatus();
      this._setInitialStatus();
    }
    return this.isConnected;
  }

  _checkExistingStatus() {
    try {
      const statusKey = this.is2004 ? "cmi.completion_status" : "cmi.core.lesson_status";
      const successKey = this.is2004 ? "cmi.success_status" : null;

      const existingStatus = this._getValue(statusKey);
      this.hasCompletedCourse = ["completed", "passed"].includes(existingStatus);

      if (successKey) {
        this.hasPassedCourse = this._getValue(successKey) === "passed";
      } else {
        this.hasPassedCourse = existingStatus === "passed";
      }
    } catch (error) {
      console.error("[SCORMManager] Error checking status:", error);
    }
  }

  _setInitialStatus() {
    if (!this.hasCompletedCourse && this.is2004) {
      this._safeSetValues({
        "cmi.completion_status": "incomplete",
        "cmi.success_status": "unknown",
      });
    }
  }

  // ===== Core API =====
  getLastViewedPage() {
    if (!this.isConnected) return 0;
    try {
      const lastPage = parseInt(this._getValue(this.lastViewedPageVariable), 10);
      return isNaN(lastPage) ? 0 : lastPage;
    } catch {
      return 0;
    }
  }

  saveCurrentPage(pageIndex) {
    if (!this.isConnected || pageIndex <= 0) return;
    this._safeSetValue(this.lastViewedPageVariable, pageIndex.toString());
  }

  setLessonStatus(status, score = null) {
    if (!this.isConnected || this._wouldDowngradeStatus(status)) return;
    try {
      this._setStatusForVersion(status);
      if (score !== null) this._setScoreForVersion(score);
      this.scormSession.commit();
    } catch (error) {
      console.error(`[SCORMManager] Error setting status: ${error}`);
    }
  }

  resetData() {
    if (!this.isConnected) return;
    try {
      this._safeSetValue(this.lastViewedPageVariable, "0");
      this.hasCompletedCourse = false;
      this.hasPassedCourse = false;
      if (this.is2004) {
        this._safeSetValues({
          "cmi.completion_status": "incomplete",
          "cmi.success_status": "unknown",
        });
      } else {
        this._safeSetValue("cmi.core.lesson_status", "incomplete");
      }
      this.scormSession.commit();
    } catch (error) {
      console.error("[SCORMManager] Error resetting data:", error);
    }
  }
  // ===== Section helper=====
  // Add these methods to the SCORMManager class

setCustomData(key, value) {
  if (!this.scormSession) {
    console.warn(`[SCORM] Cannot setCustomData - no scorm session`);
    return false;
  }
  
  console.log(`[SCORM] Attempting to save custom data - key: ${key}, value: ${value}`);
  
  try {
    // Primero recuperamos todo el suspendData actual
    const currentData = this.scormSession.getValue("cmi.suspend_data") || "{}";
    let dataObj = {};
    
    try {
      dataObj = JSON.parse(currentData);
    } catch (e) {
      console.warn(`[SCORM] Error parsing existing suspend_data: ${e}`);
    }
    
    // Establecemos el nuevo valor
    dataObj[key] = value;
    
    // Guardamos todo de vuelta
    const success = this.scormSession.setValue("cmi.suspend_data", JSON.stringify(dataObj));
    
    // Commit inmediato para asegurar que se guarde
    this.scormSession.commit();
    
    console.log(`[SCORM] Custom data saved: ${key}=${value}, success=${success}`);
    return success;
  } catch (error) {
    console.error(`[SCORM] Error saving custom data: ${error}`);
    return false;
  }
}

getCustomData(key) {
  if (!this.scormSession) {
    console.warn(`[SCORM] Cannot getCustomData - no scorm session`);
    return null;
  }  
  console.log(`[SCORM] Attempting to retrieve custom data for key: ${key}`);
  try {
    const dataString = this.scormSession.getValue("cmi.suspend_data") || "{}";
    let dataObj = {};    
    try {
      dataObj = JSON.parse(dataString);
    } catch (e) {
      console.warn(`[SCORM] Error parsing suspend_data: ${e}`);
      return null;
    }    
    const value = dataObj[key] || null;
    console.log(`[SCORM] Retrieved custom data: ${key}=${value}`);
    return value;
  } catch (error) {
    console.error(`[SCORM] Error retrieving custom data: ${error}`);
    return null;
  }
}

isCourseIncompleteOrNotPassed() {
  const status = this.getLessonStatus(); // Devuelve la cadena de estado actual
  // Para SCORM 1.2 e SCORM 2004, considera 'incomplete', 'failed' o 'not passed'
  return status === "incomplete" || status === "failed" || status === "not passed";
}

getLessonStatus() {
  if (!this.scormSession) return "not attempted";
  const statusKey = this.is2004 ? "cmi.completion_status" : "cmi.core.lesson_status";
  return this.scormSession.getValue(statusKey) || "not attempted";
}

isCourseIncompleteOrNotPassed() {
  const status = this.getLessonStatus();
  return status === "incomplete" || status === "failed" || status === "not passed";
}

  // ===== Helpers =====
  _wouldDowngradeStatus(status) {
    return (
      (status === "incomplete" && this.hasCompletedCourse) ||
      (status === "failed" && this.hasPassedCourse)
    );
  }

  _setStatusForVersion(status) {
    if (this.is2004) {
      this._set2004Status(status);
    } else {
      this._set12Status(status);
    }
  }

  _set2004Status(status) {
    if (["completed", "incomplete"].includes(status)) {
      this._safeSetValue("cmi.completion_status", status);
      if (status === "completed") this.hasCompletedCourse = true;
    } else if (["passed", "failed"].includes(status)) {
      this._safeSetValue("cmi.success_status", status);
      if (status === "passed") {
        this.hasPassedCourse = true;
        this.hasCompletedCourse = true;
        this._safeSetValue("cmi.completion_status", "completed");
      }
    }
  }

  _set12Status(status) {
    // Solo actualiza si no existe estado final
    if (!(this.hasCompletedCourse || this.hasPassedCourse)) {
      this._safeSetValue("cmi.core.lesson_status", status);
      if (status === "completed") this.hasCompletedCourse = true;
      if (status === "passed") {
        this.hasPassedCourse = true;
        this.hasCompletedCourse = true;
      }
    }
  }

  _setScoreForVersion(score) {
    const values = this.is2004
      ? {
          "cmi.score.scaled": (score / 100).toString(),
          "cmi.score.raw": score.toString(),
        }
      : {
          "cmi.core.score.raw": score.toString(),
          "cmi.core.score.min": "0",
          "cmi.core.score.max": "100",
        };
    this._safeSetValues(values);
  }

  _getValue(key) {
    return this.scormSession.getValue(key);
  }

  _safeSetValue(key, value) {
    try {
      this.scormSession.setValue(key, value);
      return true;
    } catch (error) {
      console.error(`[SCORMManager] Error setting ${key}:`, error);
      return false;
    }
  }

  _safeSetValues(keyValuePairs) {
    let success = true;
    for (const [key, value] of Object.entries(keyValuePairs)) {
      if (!this._safeSetValue(key, value)) success = false;
    }
    return success;
  }
}
