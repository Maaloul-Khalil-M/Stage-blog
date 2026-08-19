import {ApplicationConfig, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideEchartsCore} from 'ngx-echarts';
import * as echarts from 'echarts';
import {provideRouter} from '@angular/router';
import {routes} from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideEchartsCore({echarts}),
    provideBrowserGlobalErrorListeners()
  ]
};
