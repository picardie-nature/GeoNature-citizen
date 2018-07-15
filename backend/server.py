import logging

from flask import Flask, request, jsonify
from flask_jwt_extended import JWTManager
from flask_marshmallow import Marshmallow
from flask_restful import Api
from flask_sqlalchemy import SQLAlchemy

logger = logging.getLogger()
logger.setLevel(10)

app = Flask(__name__)
api = Api(app)

app.debug = True

# Configuration de la bdd
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
ma = Marshmallow(app)
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

# JWTManager
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string'
app.config['JWT_BLACKLIST_ENABLED'] = True
app.config['JWT_BLACKLIST_TOKEN_CHECKS'] = ['access', 'refresh']

jwt = JWTManager(app)

from gncitizen.core import models as gnmodels, resources as gnresources
from gncitizen.sights import resources as siresources
from gncitizen.sights.models import SightsSchema, SightModel


@jwt.token_in_blacklist_loader
def check_if_token_in_blacklist(decrypted_token):
    jti = decrypted_token['jti']
    return gnmodels.RevokedTokenModel.is_jti_blacklisted(jti)


# core
api.add_resource(gnresources.UserRegistration, '/registration')
api.add_resource(gnresources.UserLogin, '/login')
api.add_resource(gnresources.UserLogoutAccess, '/logout/access')
api.add_resource(gnresources.UserLogoutRefresh, '/logout/refresh')
api.add_resource(gnresources.TokenRefresh, '/token/refresh')
api.add_resource(gnresources.AllUsers, '/users')
api.add_resource(gnresources.SecretResource, '/secret')

# Sights
api.add_resource(siresources.AllSights, '/sights/')
api.add_resource(siresources.SightAdd, '/sights/add')


@app.route('/sight', methods=['POST'])
def add_sight():
    # mount exam object
    json = request.get_json()
    if not json_data:
        return jsonify({'message': 'No input data provided'}), 400
    logger.warning(json)
    posted_sight = SightsSchema().load(json)
    logger.warning(posted_sight.data)
    sight = SightModel(posted_sight.data)
    logger.warning(sight)

    sight.save_to_db()

    # return created exam
    new_sight = SightsSchema().dump(sight).data
    return jsonify(new_sight), 201

@app.before_first_request
def create_tables():
    db.create_all()
