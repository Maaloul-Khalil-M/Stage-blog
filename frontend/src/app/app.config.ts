import {ApplicationConfig, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideEchartsCore} from 'ngx-echarts';
import * as echarts from 'echarts';

export const appConfig: ApplicationConfig = {
  providers: [
    provideEchartsCore({echarts}),
    provideBrowserGlobalErrorListeners()
  ]
};
