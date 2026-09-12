import { IDataProvider } from './types';
import { ExcelDataProvider, DEFAULT_EXCEL_PATHS } from './excel-data-provider';

export * from './types';
export * from './excel-data-provider';

let activeDataProvider: IDataProvider | null = null;

export function getDataProvider(): IDataProvider {
  if (!activeDataProvider) {
    activeDataProvider = new ExcelDataProvider({
      gironeAPath: DEFAULT_EXCEL_PATHS.gironeA,
      gironeBPath: DEFAULT_EXCEL_PATHS.gironeB,
      gareClassificaPath: DEFAULT_EXCEL_PATHS.gareClassifica,
    });
  }
  return activeDataProvider;
}

export function setDataProvider(provider: IDataProvider) {
  activeDataProvider = provider;
}
