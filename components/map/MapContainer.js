import React, { Component } from 'react';
import { Image, View, Text, Modal, Button, StyleSheet, Animated, Alert } from 'react-native';
import { Constants, Location, Permissions, MapView } from 'expo';
import { EvilIcons } from '@expo/vector-icons';
import axios from 'axios';
import geodist from 'geodist';
import Polyline from '@mapbox/polyline';

import MapModal from './MapModal';
import MapCallout from './MapCallout';
import MapRoutePicker from './MapRoutePicker';

import URL from '../env/urls';
import Helpers from '../lib/util';

const GEOLOCATION_OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 };

export default class MapContainer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      location: {},
      results: [],
      modalVisible: false,
      stop: null,
      selected: '',
      route: '',
      coords: [],
      directionsData: {},
    };

    this.showModal = this.showModal.bind(this);
    this.hideModal = this.hideModal.bind(this);
    this.onDetailsPress = this.onDetailsPress.bind(this);
    this.onRoutePick = this.onRoutePick.bind(this);

    this.opacityValue = new Animated.Value(1);
    this._fade = this._fade.bind(this);
  }

  componentWillMount() {
    this.locationChanged();
    this.getDirections();
  }

  onDetailsPress(route, stop) {
    this.hideModal();
    this.props.navigation.navigate('Details', { route, stop });
  }

  onRoutePick(route) {
    if (!route) {
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
        el[0] = el[0].split('-').pop().slice(0, -1).toUpperCase();
        let temp = newState.results.find((a) => a.stop_id.includes(el[0]));
        temp && temp.count !== undefined ? temp.count += el[1] : temp.count = el[1];
      });
      this.setState(newState);
    })
    .catch((error) => console.log(error));
  }

  getDirections = async (startLoc, destinationLoc, stop) => {
    try {
      let resp = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${ startLoc }&destination=${ destinationLoc }&mode=walking`)
      let respJson = await resp.json();
      let points = Polyline.decode(respJson.routes[0].overview_polyline.points);
      let coords = points.map((point, index) => ({ latitude : point[0], longitude : point[1] }));
      this.setState({
        selected: stop ? stop.stop_name : '',
        stop: stop,
        coords: coords,
        directionsData: respJson.routes[0].legs[0]
      });
      return coords;
    } catch (error) {
      console.log(error);
    }
  }

  locationChanged = async () => {
    let { status } = await Permissions.askAsync(Permissions.LOCATION);
    if (status !== 'granted') {
      return this.setState({
        errorMessage: 'Permission to access location was denied',
      });
    }

    let location = await Location.getCurrentPositionAsync({});
    axios.get(`${URL}/api/stops/location`, {
      params: {
        sub: 'mta',
        lat: location.coords.latitude,
        lon: location.coords.longitude
      }
    })
    .then(({ data }) => this.setState({ results: data, location: location }))
    .catch((err) => console.log('ERROR IN AXIOS REQUEST', err), 
    );
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

            {this.state.location.coords ?
              <MapView.Marker
                coordinate={{ latitude: Number(this.state.location.coords.latitude), longitude: Number(this.state.location.coords.longitude) }}
                pinColor="#38A2FF">
              </MapView.Marker> : null }

            {this.state.results.map((marker, idx) =>
              <MapView.Marker
                key={idx}
                coordinate={{ latitude: Number(marker.stop_lat), longitude: Number(marker.stop_lon) }}
                onPress={() => this.getDirections(`${this.state.location.coords.latitude}, ${this.state.location.coords.longitude}`, `${marker.stop_lat}, ${marker.stop_lon}`, marker)}
                pinColor={Helpers.MarkerColorHelper(marker.count || 0)}>
                <MapView.Callout
                  onPress={this.showModal}>
                    <MapCallout
                      stop={marker}
                      directionsData={this.state.directionsData}
                      count={marker.count || 0} />
                </MapView.Callout>
              </MapView.Marker>)}

              <MapView.Polyline
                coordinates= {this.state.coords}
                strokeWidth={2}
                strokeColor="blue" />

          </MapView>
        </Animated.View>

        <MapRoutePicker onRoutePick={this.onRoutePick} />
        
        <Modal
          animationType={'fade'}
          transparent={true}
          visible={this.state.modalVisible}
          onRequestClose={this.hideModal}>
          <MapModal
            stop={this.state.stop}
            routes={this.state.results.filter((stop, idx) => this.state.selected === stop.stop_name)}
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

MapContainer.navigationOptions = {
  title: 'Map',
  headerStyle: {
    backgroundColor: 'grey'
  },
  headerTitleStyle: {
    color: 'white'
  },
  headerTintColor: 'white'
};