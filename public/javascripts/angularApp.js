var app = angular.module('flapperNews', ['ui.router']);

app.factory('posts', ['$http', 'auth', function($http, auth) {
	var o = {
		posts: []
	};

//.then is a promise that fires when post is returned
//.data is property of the response object from $http, not express
	o.get = function(id) {
		return $http.get('/posts/' + id).then(function(res) {
			return res.data;
		});
	};
	
	o.getAll = function() {
		return $http.get('/posts').success(function(data) {
			angular.copy(data, o.posts);
		});
	};

	o.create = function(post) {
		return $http.post('/posts', post, {
			headers: {Authorization: 'Bearer ' + auth.getToken()}
		}).success(function(data) {
			o.posts.push(data);
		});
	};

	o.upvote = function(post) {
		return $http.put('/posts/' + post._id + '/upvote', null, {
			headers: {Authorization: 'Bearer ' + auth.getToken()}
		}).success(function(data) {
			post.upvotes += 1;
		});
	};

	o.upvoteComment = function(post, comment) {
		return $http.put('/posts/' + post._id + '/comments/' + comment._id + '/upvote', null, {
			headers: {Authorization: 'Bearer ' + auth.getToken()}
		})
		.success(function(data) {
			comment.upvotes += 1;
		});
	};

	o.addComment = function(id, comment) {
		return $http.post('/posts/' + id + '/comments', comment, {
			headers: {Authorization: 'Bearer ' + auth.getToken()}
		});
	};

	return o;
}]);

app.factory('auth', ['$http', '$window', function ($http, $window) {
	var auth = {};

/*Methods for saving and retrieving token to localStorage*/
	auth.saveToken = function(token) {
		$window.localStorage['flapper-news-token'] = token;
	};

	auth.getToken = function() {
		return $window.localStorage['flapper-news-token'];
	};

	auth.isLoggedIn = function() {
		var token = auth.getToken();
/*Payload is a JSON object that has been base 64 url encoded*/
/*Base 64utl encoded web token looks like xxx.xxxxx.x
 (but much longer)*/
/* Payload is middle part of a token between two .
Can return to JSON with $window.atob(), back to javascript
object with JSON.parse()*/

		if(token) {
			var payload = JSON.parse($window.atob(token.split('.')[1]));
		
		return payload.exp > Date.now() / 1000;
		}
		else { return false; }
	};

	auth.currentUser = function() {
		if(auth.isLoggedIn()) {
			var token = auth.getToken();
			var payload = JSON.parse($window.atob(token.split('.')[1]));

			return payload.username;		
		}
	};

	/*Methods for registering and logging in users*/
	auth.register = function(user) {
		return $http.post('/register', user).success(function(data) {
			auth.saveToken(data.token);
		});
	};

	auth.logIn = function(user) {
		return $http.post('/login', user).success(function(data) {
			auth.saveToken(data.token);
		});
	};

	auth.logOut = function() {
		$window.localStorage.removeItem('flapper-news-token');
	};

	return auth;
}]);


app.config(['$stateProvider', '$urlRouterProvider',
	function($stateProvider, $urlRouterProvider) {
		$stateProvider

		.state('home', {
			url: '/home',
			templateUrl: '/home.html',
			controller: 'MainCtrl',
			resolve: {
				postPromise: ['posts', function(posts) {
					return posts.getAll();
				}]
			}
		})

		.state('posts', {
			url: '/posts/{id}',
			templateUrl: '/posts.html',
			controller: 'PostsCtrl',
			resolve: {
				post: ['$stateParams', 'posts', function($stateParams, posts) {
					return posts.get($stateParams.id);
				}]
			}
		})

		.state('login', {
			url: '/login',
			templateUrl: '/login.html',
			controller: 'AuthCtrl',
			onEnter: ['$state', 'auth', function($state, auth) {
				if(auth.isLoggedIn()){
					$state.go('home');
				}
			}]
		})

		.state('register', {
			url: '/register',
			templateUrl: '/register.html',
			controller: 'AuthCtrl',
			onEnter: ['$state', 'auth', function($state, auth) {
				if(auth.isLoggedIn()) {
					$state.go('Home');
				}
			}]
		});
		
		$urlRouterProvider.otherwise('home');
}]);



app.controller('MainCtrl', [
	'$scope', 'posts', 'auth',
	function($scope, posts, auth) {
		$scope.posts = posts.posts;
		$scope.isLoggedIn = auth.isLoggedIn;

		$scope.addPost = function() {
			if(!$scope.title || $scope.title === '') {return;}
			posts.create( {
				title: $scope.title,
				link: $scope.link
			});

			$scope.title = "";
			$scope.link = "";
		};

		$scope.incrementUpvotes = function(post) {
			posts.upvote(post);
		};
		$scope.incrementDownvotes = function(post) {
			post.upvotes -= 1;
		};
}]);

app.controller('PostsCtrl', ['$scope', 'post', 'posts', 'auth',
	function($scope, post, posts, auth) {
		$scope.post = post;
		$scope.isLoggedIn = auth.isLoggedIn;

		$scope.addComment = function() {
			if($scope.body === '') {return;}
			posts.addComment(post._id, {
				body: $scope.body,
				author: 'user',
			}).success(function(comment) {
				$scope.post.comments.push(comment);
			});

			$scope.body = '';
		};

		$scope.incrementUpvotes = function(comment) {
			posts.upvoteComment(post, comment);
		};
}]);

app.controller('AuthCtrl', ['$scope', '$state', 'auth', function($scope, $state, auth) {
	$scope.user = {};

	$scope.register = function() {
		auth.register($scope.user).error(function(error) {
			$scope.error = error;
		}).then(function(){
			$state.go('home');
		});
	};

	$scope.logIn = function() {
		auth.logIn($scope.user).error(function(error) {
			$scope.error = error;
		}).then(function() {
			$state.go('home');
		});
	};
}]);

/*Tie-in auth functions to scope function for access in UI*/
app.controller('NavCtrl', ['$scope', 'auth', function($scope, auth) {
	$scope.isLoggedIn = auth.isLoggedIn;
	$scope.currentUser = auth.currentUser;
	$scope.logOut = auth.logOut;
}])
