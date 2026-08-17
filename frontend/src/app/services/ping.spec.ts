import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PingService } from './ping.service';

describe('PingService', () => {
  let service: PingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches ping status from the backend', () => {
    service.getStatus().subscribe(response => {
      expect(response.status).toBe('ok');
    });

    const req = httpMock.expectOne('/api/ping');
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'ok' });
  });
});
