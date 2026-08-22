import {Component} from '@angular/core';
//import { RouterLink, RouterOutlet } from '@angular/router';
import {LeaveRequestStepperComponent} from './LeaveRequestStepperComponent';

@Component({
             selector: 'app-root',
             //imports: [RouterOutlet, RouterLink, LeaveRequestStepperComponent]
             imports: [LeaveRequestStepperComponent],
             templateUrl: './app.component.html',
             styleUrl: './app.component.scss',
           })
export class AppComponent {
}
