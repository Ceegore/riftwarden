export const diagnostic = (code,path,message,details={}) => ({code,path,message,...details});
export const summary = diagnostics => ({status:diagnostics.length?'BLOCKED':'PASS',diagnosticCount:diagnostics.length,diagnostics});
