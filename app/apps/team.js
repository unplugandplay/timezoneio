var React  = require('react');
var moment = require('moment-timezone');
require('whatwg-fetch');

var transform = require('../utils/transform.js');
var timeUtils = require('../utils/time.js');
var clone = require('../utils/toolbelt.js').clone;

var AppDispatcher = require('../dispatchers/appDispatcher.js');
var ActionTypes = require('../actions/actionTypes.js');
var AppState = require('../state/appState.js');

var Team = React.createFactory(require('../views/team.jsx'));


// Application state:
var appState = new AppState(window.appData);


// Add the component to the DOM
var targetNode = document.querySelector('#page');

function renderApp() {
  React.render( Team( appState.getState() ), targetNode );
}

renderApp();

// Allow arrow keys to change time by selecting time range input
var KEY = {
  LEFT:  37,
  RIGHT: 39
};
var timeSlider = document.querySelector('.time-slider');

window.addEventListener('keyup', function(e){

  if (e.keyCode === KEY.RIGHT || e.keyCode === KEY.LEFT) {
    e.preventDefault();
    disableAutoUpdate();
    timeSlider.focus();
    renderApp();
  }

});

function updateToCurrentTime() {
  appState.updateToCurrentTime();
  renderApp();
}

// 0 is now, 1.0 is in 12 hours, -1.0 is 12 hours ago
function updateTimeAsPercent(percentDelta) {

  if (percentDelta === 0) {
    enableAutoUpdate();
    return updateToCurrentTime();
  }

  var MIN_IN_12_HOURS = 720;
  var deltaMinutes = MIN_IN_12_HOURS * percentDelta;

  var now = moment();
  now.add(deltaMinutes, 'm');

  // Round to quarter hour
  var minutes = now.minutes();
  now.add(timeUtils.roundToQuarterHour(minutes) - minutes, 'm');

  appState.setTime(now);

  renderApp();
}


function json(res) {
  return res.json();
}
function saveTeamInfo(info) {

  info._csrf = appState.getCSRF();

  var options = {
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(info)
  };

  return fetch('/api/team/' + appState.getTeam()._id, options)
    .then(json)
    .then(function(res){
      console.info(res);
      return res;
    });
}

function updateCurrentView(view, shouldUpdateUrl) {

  appState.setCurrentView(view);

  if (shouldUpdateUrl) {
    var path = appState.getTeam().url;

    if (view !== 'app')
      path += '/' + view;

    window.history.pushState({}, null, path);
  }

  renderApp();
}

function handlePopState(e) {
  var path = window.location.pathname;
  var segment = path.replace(appState.getTeam().url, '');
  var view = segment.length ? segment.substr(1) : 'app';
  updateCurrentView(view);
}


window.addEventListener('popstate', handlePopState);

var handleViewAction = function(action) {
  var actionType = action.actionType;
  var value = action.value;

  switch (actionType) {

    case ActionTypes.CHANGE_TIME_FORMAT:
      appState.setTimeFormat(value);
      renderApp();
      break;
    case ActionTypes.USE_CURRENT_TIME:
      updateToCurrentTime();
      enableAutoUpdate();
      break;
    case ActionTypes.ADJUST_TIME_DISPLAY:
      disableAutoUpdate();
      updateTimeAsPercent(value);
      break;

    case ActionTypes.CLOSE_MODAL:
      updateCurrentView('app', true);
      break;
    case ActionTypes.SHOW_MODAL:
      updateCurrentView(value, true);
      break;

    case ActionTypes.SAVE_TEAM_INFO:
      saveTeamInfo(value);
      break;

  }
};

var handleAPIAction = function(action) {
  var actionType = action.actionType;
  var value = action.value;

  switch (actionType) {

    case ActionTypes.UPDATED_USER_DATA:
      appState.updateUserData(value);
      renderApp();
      break;

  }
};

AppDispatcher.register(function(payload) {

  if (payload.source === 'API_ACTION')
    handleAPIAction(payload.action);
  else if (payload.source === 'VIEW_ACTION')
    handleViewAction(payload.action);

});



// Auto updating the time

var autoUpdateIntervalId = null;
function enableAutoUpdate() {

  // Check every 20 seconds for an updated time
  autoUpdateIntervalId = setInterval(updateToCurrentTime, 1000 * 20);

  // Check on window focus
  window.onfocus = updateToCurrentTime;
}

function disableAutoUpdate() {
  clearInterval(autoUpdateIntervalId);
  window.onfocus = null;
}

enableAutoUpdate();
