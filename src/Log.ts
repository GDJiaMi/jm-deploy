export default class Log {
  public static enabled: boolean = false;
  public static log: typeof console.log = (...args: any[]) => {
    if (Log.enabled) {
      console.log(...args);
    }
  };
}
