import { Component,ViewChild  } from '@angular/core';
import { DataStorageService } from '../services/data-storage.service';
import { ApiService } from '../services/api.service'
import { interval} from 'rxjs';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { CheckboxCustomEvent } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})

export class HomePage {
  @ViewChild('waterlevel') waterlevel;
  @ViewChild('projectedPPT') projectedPPT;
  @ViewChild('actualPPT') actualPPT;
  @ViewChild('overflow') overflow;
  @ViewChild('stored') stored;
  @ViewChild('drained') drained;
  dashboardData:any={"waterlevel":0};
  drainThreshold=20;
  latitude:any;
  longitude:any;
  dashboardPrecipitationValues:any=[];
  activeDashboardElements:any=[];
  buttonAuto = false
  isDraining = false
  tracking_short:any;
  tracking_long:any;
  connectedToController:boolean = false;

  termsAccepted:boolean;

  constructor(
    private dataStorageService: DataStorageService,
    private apiService: ApiService,
    private http: HttpClient,
    private storage: Storage
  ){
    this.dataStorageService
    .getStoredData('activeDashboardElements')
    .then((activeDashboardElements) => {
      if(activeDashboardElements!=null){
      this.activeDashboardElements = activeDashboardElements
      }
    })
    this.loadTermsAccepted();
    this.getDashboardData();
    this.initLatLon();
    this.getDashboardPrecipitationValues();
  }
  ngAfterViewInit() {
    console.log("terms accepted is"+this.termsAccepted)
    this.getDashboardPrecipitationValues();
    this.tracking_short = interval(5000)
      .subscribe(() => {
        this.getDashboardData();
        this.initLatLon();
        this.getDashboardPrecipitationValues();
      });
  }
  ngOnDestroy() {
    this.tracking_short.unsubscribe;
    this.tracking_long.unsubscribe;
  }
  ionViewWillEnter() {
    this.dataStorageService
      .getStoredData('activeDashboardElements')
      .then((activeDashboardElements) => {
        if(activeDashboardElements!=null){
          this.activeDashboardElements = activeDashboardElements
        }
      })
  }
  getJsonData(url: string): Observable<any> {
    return this.http.get(url);
  }
  getSwatApiUrl(lat:number, lon:number){
    const baseUrl = 'https://swat.itwh.de/Vorhersage';
    const urlParams = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
    });
    let url = `${baseUrl}?${urlParams.toString()}`;
    return url;
  }

  getTestSwatApiUrl(lat:number, lon:number) {
    return "https://swat.itwh.de/Vorhersage/GetVorhersageTest?lat=0&lon=0"
  }

  summarizeForecastValues(num:number,forecast:any,fiveMinVal:number): number {
    let values = Object.values(forecast); // Extract all values from the object
    values = values.slice(0, num); // Get the first 10 values
    const sum = values.reduce((accumulator:number, currentValue) => accumulator + (currentValue as number), 0);
    return sum+fiveMinVal;
  }
  getDashboardPrecipitationValues() {
    if(this.isLocationEmpty()) return;

    let isTestData = this.latitude == 0 && this.longitude == 0;

    if (isTestData) {
      let url = this.getTestSwatApiUrl(this.latitude,this.longitude);
      this.getJsonData(url).subscribe(
        (data) => {
          let json = data;
          let currentTime = json["vorhersageZeit"];
          let forecast = json["vorhersage"];
          let fiveMinVal = json["aktuell"][currentTime];
          console.log("json: "+JSON.stringify(json));
          let oneHourVal = this.summarizeForecastValues(11,forecast,fiveMinVal);
          let twoHourVal = this.summarizeForecastValues(23,forecast,fiveMinVal);
          console.log("forecast: "+JSON.stringify(forecast));
          console.log("fiveMinVal: "+fiveMinVal);
          console.log("oneHourVal: "+oneHourVal);
          console.log("twoHourVal: "+twoHourVal);
          this.dashboardPrecipitationValues =  [fiveMinVal,oneHourVal,twoHourVal];
        }
      );
    } else {
      let url = this.getSwatApiUrl(this.latitude,this.longitude);
      this.getJsonData(url).subscribe(
        (data) => {
          let json = data;
          let currentTime = json["vorhersageZeit"];
          let forecast = json["vorhersage"];
          let fiveMinVal = json["aktuell"][currentTime];
          console.log("json: "+JSON.stringify(json));
          let oneHourVal = this.summarizeForecastValues(11,forecast,fiveMinVal);
          let twoHourVal = this.summarizeForecastValues(23,forecast,fiveMinVal);
          console.log("forecast: "+JSON.stringify(forecast));
          console.log("fiveMinVal: "+fiveMinVal);
          console.log("oneHourVal: "+oneHourVal);
          console.log("twoHourVal: "+twoHourVal);
          this.dashboardPrecipitationValues =  [fiveMinVal,oneHourVal,twoHourVal];
        }
      );
    }
  }
  getDashboardData(){
    var context = this
    setTimeout(function(){
      context.apiService
      .getDashboardConfig()
      .subscribe({
        next: (data) => {
          context.dashboardData = data;
          context.isDraining = data["is_draining"];
          context.drainThreshold = parseInt(data["drain_threshold"]*100+"");
          //console.log('response data: ' + JSON.stringify(context.dashboardData))
          context.connectedToController = true;
        },
        error: (error) => {
          console.log('Error HTTPResponse' + JSON.stringify(error));
          context.connectedToController = false;
        },
      })
    }.bind(context), 1000);
  }
  isDashboardEmpty(){
    return this.activeDashboardElements == null||this.activeDashboardElements == ""||this.activeDashboardElements.length<=0;
  }
  isLocationEmpty(){
    let isEmpty = this.longitude == null && this.latitude == null;
    return isEmpty;
  }
  checkActiveDashboardElement(dashboardElement) {
    return this.activeDashboardElements.includes(dashboardElement)
  }
  saveDashboardData(mode){
    let payload = this.dashboardData;
    payload["drain_threshold"] = this.drainThreshold/100;
    /*payload["control_mode"]=this.dashboardData.control_mode
    this.buttonAuto = this.dashboardData.control_mode*/
    payload["control_mode"]=mode
    this.buttonAuto = mode
    console.log(JSON.stringify(payload))
    this.apiService
    .setDashbardConfig(payload)
    if(this.isDraining)this.apiService.stopDrain();
  }
  drainPartial(){
    this.apiService
    .drain(this.drainThreshold/100)
  }
  drainComplete(){
    this.apiService
    .drainComplete("")
  }
  stopDrain(){
    console.log("stopping drain");
    this.apiService.stopDrain()
  }
  async onTermsChanged(event: Event) {
    const ev = event as CheckboxCustomEvent;
    if(ev.detail.checked){
      await this.acceptTerms();
    }
  }
  async loadTermsAccepted() {
    // Load the value from storage. If it doesn't exist, default to false.
    this.termsAccepted = (await this.storage.get('termsAccepted')) || false;
    console.log("loadtermsaccepted: "+this.termsAccepted);
  }
  async acceptTerms() {
    // Set the variable to true and save it to storage.
    await this.storage.set('termsAccepted', true);
    await this.loadTermsAccepted();
    console.log("acceptterms: "+this.termsAccepted);
  }
  initLatLon(){
    this.dataStorageService
    .getStoredData('lat')
    .then((lat) => {
      if (lat != null) {
        this.latitude = lat
      }
    })

    this.dataStorageService
    .getStoredData('long')
    .then((long) => {
      if (long != null) {
        this.longitude = long
      }
    })
  }
}
