from flask import jsonify, request, Blueprint
from flask_jwt_extended import (create_access_token, create_refresh_token, get_raw_jwt, get_jwt_identity,
                                jwt_refresh_token_required, jwt_required)

from gncitizen.utils.utilssqlalchemy import json_resp
from server import db
from .models import UserModel, RevokedTokenModel

routes = Blueprint('users', __name__)


@routes.route('/registration', methods=['POST'])
@json_resp
def registration():
    """
    User registration
    Utiliser le décorateur `@get_jwt_identity()`
    pour avoir l'identité de l'utilisateur courant. Exemple:

    ``` python
    @routes.route('/protected', methods=['GET'])
    @jwt_required
    def protected():
        # Access the identity of the current user with get_jwt_identity
        current_user = get_jwt_identity()
        return jsonify(current_suer=current_user), 200
    ```
    ---
    tags:
      - Authentication
    summary: Creates a new sight
    consumes:
      - application/json
    produces:
      - application/json
    parameters:
      - name: body
        in: body
        description: JSON parameters
        required: true
        schema:
          required:
            - name
            - surname
            - username
            - email
            - password
          properties:
            name:
              type: string
            surname:
              type: string
            username:
              type: string
            email:
              type: string
            password:
              type: string
    responses:
      200:
        description: user created
    """
    try:
        request_datas = dict(request.get_json())
        datas2db = {}
        for field in request_datas:
            if hasattr(UserModel, field) and field != 'password':
                datas2db[field] = request_datas[field]

        datas2db['password'] = UserModel.generate_hash(request_datas['password'])

        try:
            newuser = UserModel(**datas2db)

        except Exception as e:
            print(e)
            raise GeonatureApiError(e)

        if UserModel.find_by_username(newuser.username):
            return jsonify({'message': 'L\'utilisateur {} éxiste déjà'.format(newuser.username)}), 400

        db.session.add(newuser)
        db.session.commit()
        access_token = create_access_token(identity=newuser.username)
        refresh_token = create_refresh_token(identity=newuser.username)
        data_json = {
            'message': 'Félicitations, l\'utilisateur <b>{}</b> a été créé'.format(newuser.username),
            'access_token': access_token,
            'refresh_token': refresh_token
        }
        return jsonify(data_json), 200

    except Exception as e:
        return {'error_message': str(e)}, 500


@routes.route('/login', methods=['POST'])
@json_resp
def login():
    """
    User login
    ---
    tags:
      - Authentication
    summary: Login
    consumes:
      - application/json
    produces:
      - application/json
    parameters:
      - name: body
        in: body
        description: JSON parameters
        required: true
        schema:
          required:
            - username
            - password
          properties:
            username:
              type: string
            password:
              type: string
    responses:
      200:
        description: user created
    """
    try:
        request_datas = dict(request.get_json())
        if request_datas is None:
            return jsonify({'message': 'No input data provided'}), 400
        # Validate and deserialize input
        if request_datas['username'] is None:
            return jsonify({"error_message": "Missing username parameter"}), 400
        if request_datas['password'] is None:
            return jsonify({"error_message": "Missing password parameter"}), 400

        username = request_datas['username']
        password = request_datas['password']

        current_user = UserModel.find_by_username(username)
        if not current_user:
            return jsonify({'message': 'User {} doesn\'t exist'.format(data['username'])}), 400
        if UserModel.verify_hash(password, current_user.password):
            access_token = create_access_token(identity=username)
            refresh_token = create_refresh_token(identity=username)
            return jsonify({
                'message': 'Logged in as {}'.format(username),
                'access_token': access_token,
                'refresh_token': refresh_token
            }), 200
        else:
            return {'error_message': 'Wrong credentials'}, 400
    except Exception as e:
        return {'error_message': str(e)}, 400


@routes.route('/logout', methods=['POST'])
@json_resp
@jwt_refresh_token_required
def logout():
    """
    User logout
    ---
    tags:
      - Authentication
    summary: Logout
    consumes:
      - application/json
    produces:
      - application/json
    parameters:
      - name: authorization
        in: authorization
        description: JSON parameter
        required: true
        schema:
          required:
            - authorization
          properties:
            authorization:
              type: string
              example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZGVudGl0eSI6ImZjbG9pdHJlIiwiZnJlc2giOmZhbHNlLCJ0eXBlIjoiYWNjZXNzIiwiZXhwIjoxNTMyMjA4Nzk0LCJqdGkiOiI5YmQ5OGEwNC1lMTYyLTQwNWMtODg4Zi03YzlhMTAwNTE2ODAiLCJuYmYiOjE1MzIyMDc4OTQsImlhdCI6MTUzMjIwNzg5NH0.oZKoybFIt4mIPF6LrC2cKXHP8o32vAEcet0xVjpCptE
    responses:
      200:
        description: user disconnected

    """
    jti = get_raw_jwt()['jti']
    try:
        revoked_token = RevokedTokenModel(jti=jti)
        revoked_token.add()
        return {'message': 'Refresh token has been revoked'}
    except:
        return {'message': 'Something went wrong'}, 500


@routes.route('/token_refresh', methods=['POST'])
@jwt_refresh_token_required
@json_resp
def token_refresh():
    """Refresh token
    ---
    tags:
      - Authentication
    summary: Refresh token for logged user
    produces:
      - application/json
    responses:
      200:
        description: list all logged users
    """
    current_user = get_jwt_identity()
    access_token = create_access_token(identity=current_user)
    return {'access_token': access_token}


@routes.route('/allusers', methods=['GET'])
@jwt_required
@json_resp
def get_allusers():
    """list all users
    ---
    tags:
      - Authentication
    summary: List all registered users
    produces:
      - application/json
    responses:
      200:
        description: list all users
    """
    allusers = UserModel.return_all()
    return allusers, 200


#
# @routes.route('/allusers', methods=['DELETE'])
# @jwt_required
# def del_allusers():
#     """Delete all users
#     ---
#     tags:
#       - Authentication
#     summary: List all logged registered users
#     produces:
#       - application/json
#     responses:
#       200:
#         description: Delete all users
#     """
#     return jsonify(UserModel.delete_all()), 200


@routes.route('/logged_user', methods=['GET'])
@json_resp
@jwt_required
def logged_user():
    """list all logged users
    ---
    tags:
      - Authentication
    summary: List all logged registered users
    produces:
      - application/json
    responses:
      200:
        description: list all logged users
    """
    current_user = get_jwt_identity()
    user = UserModel.query.filter_by(username=current_user).first()
    return user, 200