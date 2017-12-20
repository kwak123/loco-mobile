import React, { Component } from 'react';
import { Image, View, Text, Modal, Button, StyleSheet, Animated } from 'react-native';
import { Constants, Location, Permissions, MapView } from 'expo';
import { EvilIcons } from '@expo/vector-icons';
import axios from 'axios';
import geodist from 'geodist';
import Polyline from '@mapbox/polyline';

import URL from '../env/urls';
import MapDeets from './MapDeets';
import MapCallout from './MapCallout';
import MapRoutePicker from './MapRoutePicker';
import Helpers from '../lib/util';

const GEOLOCATION_OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 };

export default class UserMap extends Component {
  constructor(props) {
    super(props);
    this.state = {
      location: {},
      results: [],
      modalVisible: false,
      stop: null,
      selected: '',
      coords: [],
      directionsData: {},
      route: ''
    };

    this.showModal = this.showModal.bind(this);
    this.hideModal = this.hideModal.bind(this);
    this.onDetailsPress = this.onDetailsPress.bind(this);
    this.onRoutePick = this.onRoutePick.bind(this);

    this.opacityValue = new Animated.Value(1);
    this._fade = this._fade.bind(this);
  }

  componentWillMount() {
    this.locationChanged()
  }

  locationChanged = async () => {
    let { status } = await Permissions.askAsync(Permissions.LOCATION);
    if (status !== 'granted') {
      this.setState({
        errorMessage: 'Permission to access location was denied',
      });
    }

    let location = await Location.getCurrentPositionAsync({})
    this.setState({
      location: location
    }, () => {
      axios.get(`${URL}/api/stops/location`, {
        params: {
          lat: this.state.location.coords.latitude,
          lon: this.state.location.coords.longitude
        }
      })
      .then((response) => {
        this.setState({
          results: response.data
        })
      }, () => {
        console.log('THIS.STATE.RESULTS:', this.state.results)
      })
      .catch((err) => {
        console.error('ERROR IN AXIOS REQUEST', err)
      })
    })
  }

  getDirections = async (startLoc, destinationLoc) => {
    try {
      let resp = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${ startLoc }&destination=${ destinationLoc }&mode=walking`)
      let respJson = await resp.json();

      // SJK: This is a  bad antipattern. Just use respJson for whatever
      // you're trying to get, then set state at one time. 
      this.setState({
        directionsData: respJson
      }, () => {
        console.log('THIS.STATE.DIRECTIONSDATA:', this.state.directionsData)
        // console.log('THIS.STATE.DIRECTIONSDATA.ROUTES:', this.state.directionsData.routes)
      })
  
      let points = Polyline.decode(respJson.routes[0].overview_polyline.points);
      let coords = points.map((point, index) => {
        return {
          latitude : point[0],
          longitude : point[1]
        }
      })
      this.setState({coords: coords})
      return coords;
    } catch (error) {
      console.log(error);
    }
  }

  onDetailsPress(route) {
    this.hideModal();
    this.props.navigation.navigate('Details', { route, stop: this.state.stop });
  }

  onRoutePick(route) {
    if (route === this.state.route) {
      return this.setState({ results: [], route: '' }, this.locationChanged);
    }
    let newState = { route };
    axios.get(`${URL}/api/route/stops`, {
      params: {
        sub: 'mta',
        route_id: route
      }
    })
    .then(({ data }) => {
      newState.results = data.N;
      return axios.get(`${URL}/api/report/reports`, {
        params: {
          sub: 'mta',
          route_id: route
        }
      });
    })
    .then(({ data }) => {
      data.forEach((el, idx) => {
        el[0] = el[0].split('-').pop().slice(0, -1);
        let temp = newState.results.find((a) => a.stop_id.includes(el[0]));
        temp && temp.count !== undefined ? temp.count += el[1] : temp.count = el[1];
      });
      
      // Temp fix for known React Native bug
      this.setState(newState);
    })
    .catch((error) => console.log(error));
  }

  showModal() {
    this.setState({ modalVisible: true }, () => this._fade(0.4));
  }

  hideModal() {
    this.setState({ modalVisible: false }, () => this._fade(1));
  }

  _fade(final = 1) {
    Animated.timing(
      this.opacityValue,
      {
        toValue: final
      }
    ).start();
  }

  render() {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[styles.map, { opacity: this.opacityValue }]}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: 40.750808794289775,
              longitude: -73.97638340930507,
              latitudeDelta: 0.01,
              longitudeDelta: 0.05
            }}>

            {/*this.state.location.coords ? (
              <MapView.Marker
                coordinate={{latitude: Number(this.state.location.coords.latitude), longitude: Number(this.state.location.coords.longitude)}}
                title={"HI! IT\'S ME!!!"}
                onPress={() => {
                  // console.log('you pressed me!!!')
                  // console.log(`'${this.state.location.coords.latitude}', '${this.state.location.coords.longitude}'`)
                  // this.getDirections("40.750808794289775, -73.97638340930507", "40.750409, -73.9764837")
                  this.state.results.forEach((station, idx) => {
                    this.getDirections(`'${this.state.location.coords.latitude}', '${this.state.location.coords.longitude}'`, `'${station.stop_lat}', '${station.stop_lon}'`)
                })}}
                pinColor={'#38A2FF'}>
                <MapView.Callout>
                  {/* <Text>{this.state.directionsData.routes[0].legs}</Text>
                  <Text>{station.duration.text}</Text>
                  <Text>{station.distance.text}</Text>
                </MapView.Callout>
            </MapView.Marker> ) : null */}

            {this.state.results.map((marker, idx) =>
              <MapView.Marker
                key={idx}
                coordinate={{latitude: Number(marker.stop_lat), longitude: Number(marker.stop_lon)}}
                onPress={() => this.setState({ stop: marker, selected: marker.stop_name })}
                pinColor={Helpers.MarkerColorHelper(marker.count || 0)}>
                <MapView.Callout
                  key={idx}
                  onPress={this.showModal}>
                  <MapCallout stop={marker} count={marker.count || 0} />
                </MapView.Callout>
              </MapView.Marker>)}

          </MapView>
        </Animated.View>
        <MapRoutePicker onRoutePick={this.onRoutePick} />
        <Modal
          animationType={"fade"}
          transparent={true}
          visible={this.state.modalVisible}
          onRequestClose={this.hideModal}>
          <MapDeets
            stopName={this.state.selected}
            lines={this.state.results.filter((station, idx) => this.state.selected === station.stop_name)}
            hideModal={this.hideModal}
            onDetailsPress={this.onDetailsPress} />
        </Modal>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'dimgrey'
  },
  map: {
    flex: 1
  }
});

UserMap.navigationOptions = {
  title: 'Map',
  headerStyle: {
    backgroundColor: 'grey'
  },
  headerTitleStyle: {
    color: 'white'
  },
  headerTintColor: 'white'
};
