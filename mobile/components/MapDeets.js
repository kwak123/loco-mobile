import React, { Component } from 'react';
import { StyleSheet, ScrollView, Text, Image, Button } from 'react-native';
import MapLine from './MapLine';

export default class MapDeets extends Component {
  constructor(props) {
    super(props);
    this.state = {
      unique: []
    }
  }

  componentDidMount() {
    var temp = {};
    this.props.screenProps.forEach((item, idx) => {
        temp[item.route_id] = item.route_id;
    })
    this.setState({
      unique: Object.keys(temp)
    })
  }

  render() {
    // console.log('MAPDEETS PROPS:', this.props.screenProps)
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.text}>
          {this.props.screenProps[0].stop_name}
        </Text>
        {this.state.unique.map((line, idx) => 
          <MapLine key={idx} line={line} navigation={this.props.navigation} />
        )}
      </ScrollView>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  text: {
    fontWeight: 'bold',
    fontSize: 20
  }
})