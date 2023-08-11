class AvatarActor {
    setup() {
        this.setCardData({maxDistance: 0})
        this.listen("DistanceAchieved", "newDistance")
        this.statusCard = this.createCard({
            translation: [1, 0, -1],
            layers: ["pointer"],
            type: "2d",
            textureType: "image",
            textureLocation: "./assets/images/Croquet Gallery.png",
            fullBright: true,
            frameColor: 0xcccccc,
            color: 0xffffff,
            cornerRadius: 0.05,
            depth: 0.05,
            shadow: true
        })
        this.listen("MoveStatus", "moveStatus")
    }

    newDistance(data) {
        const distance = data.distance;
        if (distance > this._cardData.maxDistance) {
            this.setCardData({maxDistance: data.distance});
        }
    }

    moveStatus(data) {
        let {v3_rotate, v3_add, q_euler, q_multiply} = Microverse;
        let offset = v3_rotate([0, 0, -2], data.rotation)
        let position = v3_add(data.translation, offset)
        let q = q_euler(0, Math.PI, 0);
        let rotation =  data.rotation
        this.statusCard.translateTo(position);
        this.statusCard.rotateTo(rotation)
    }

    
}

class AvatarPawn {
    setup() {
        if (!this.isMyPlayerPawn) {return;}

        this.addFirstResponder("pointerTap", {ctrlKey: true, altKey: true}, this);
        this.addEventListener("pointerTap", this.pointerTap);

        this.addFirstResponder("pointerDown", {ctrlKey: true, altKey: true}, this);
        this.addLastResponder("pointerDown", {}, this);
        this.addEventListener("pointerDown", this.pointerDown);

        this.addFirstResponder("pointerMove", {ctrlKey: true, altKey: true}, this);
        this.addLastResponder("pointerMove", {}, this);
        this.addEventListener("pointerMove", this.pointerMove);

        this.addLastResponder("pointerUp", {ctrlKey: true, altKey: true}, this);
        this.addEventListener("pointerUp", this.pointerUp);

        this.addLastResponder("pointerWheel", {ctrlKey: true, altKey: true}, this);
        this.addEventListener("pointerWheel", this.pointerWheel);

        this.removeEventListener("pointerDoubleDown", "onPointerDoubleDown");
        this.addFirstResponder("pointerDoubleDown", {shiftKey: true}, this);
        this.addEventListener("pointerDoubleDown", this.addSticky);

        this.addLastResponder("keyDown", {ctrlKey: true}, this);
        this.addEventListener("keyDown", this.keyDown);

        this.addLastResponder("keyUp", {ctrlKey: true}, this);
        this.addEventListener("keyUp", this.keyUp);
       
    }

    



    teardown() {
        if (!this.isMyPlayerPawn) {return;}
        console.log("avatar event handler detached");
        this.removeFirstResponder("pointerTap", {ctrlKey: true, altKey: true}, this);
        this.removeEventListener("pointerTap", this.pointerTap);

        this.removeFirstResponder("pointerDown", {ctrlKey: true, altKey: true}, this);
        this.removeLastResponder("pointerDown", {}, this);
        this.removeEventListener("pointerDown", this.pointerDown);

        this.removeFirstResponder("pointerMove", {ctrlKey: true, altKey: true}, this);
        this.removeLastResponder("pointerMove", {}, this);
        this.removeEventListener("pointerMove", this.pointerMove);

        this.removeLastResponder("pointerUp", {ctrlKey: true, altKey: true}, this);
        this.removeEventListener("pointerUp", this.pointerUp);

        this.removeLastResponder("pointerWheel", {ctrlKey: true, altKey: true}, this);
        this.removeEventListener("pointerWheel", this.pointerWheel);

        this.removeEventListener("pointerDoubleDown", "onPointerDoubleDown");
        this.removeFirstResponder("pointerDoubleDown", {shiftKey: true}, this);
        this.removeEventListener("pointerDoubleDown", this.addSticky);

        this.removeLastResponder("keyDown", {ctrlKey: true}, this);
        this.removeEventListener("keyDown", this.keyDown);

        this.removeLastResponder("keyUp", {ctrlKey: true}, this);
        this.removeEventListener("keyUp", this.keyUp);
        
    }
}

export class WalkerPawn {
    walkTerrain(vq) {
        let walkLayer = this.service("ThreeRenderManager").threeLayer("walk");
        if (!walkLayer) return vq;
        const x = vq.v[0], z = vq.v[2]
        const dist = x * x + z * z;
        
        this.say("MoveStatus", {translation: this.translation, rotation: this.rotation})
        if (dist >= 10000) {
            console.log('sent 100')
            this.say("DistanceAchieved", {distance: 100})
        }
        else if (dist >= 100) {
            console.log('sent 10')
            this.say("DistanceAchieved", {distance: 10})
        }
        

        let collideList = walkLayer.filter(obj => obj.collider);
        if (collideList.length === 0) {return vq;}
        return this.collideBVH(collideList, vq);
    }

    checkPortal(vq, _time, _delta) {
        let collided = this.collidePortal(vq);
        return [vq, collided];
    }

    checkFall(vq, _time, _delta) {
        if (!this.isFalling) {return [vq, false];}
        let v = vq.v;
        v = [v[0], v[1] - this.fallDistance, v[2]];
        this.isFalling = false;
        if (v[1] < this.maxFall) {
            this.goHome();
            return [{v: [0, 0, 0], q: [0, 0, 0, 1]}, true];
        }
        return [{v: v, q: vq.q}, false];
    }

    backoutFromFall(vq, _time, _delta) {
        if (!this.checkFloor(vq)) {
            // if the new position leads to a position where there is no walkable floor below
            // it tries to move the avatar the opposite side of the previous good position.
            vq.v = Microverse.v3_lerp(this.lastCollideTranslation, vq.v, -1);
        } else {
            this.lastCollideTranslation = vq.v;
        }
        return [vq, false];
    }

    bvh(vq, time, _delta) {
        let collide_throttle = this.collide_throttle || 50;

        if ((this.actor.fall || this.spectator) && time - this.lastCollideTime > collide_throttle) {
            this.lastCollideTime = time;
            let result = this.checkFall(vq);
            if (result[1]) {return result;}
            vq = this.walkTerrain(result[0]);
        }
        
        return [vq, false];
    }
}

export default {
    modules: [
        {
            name: "AvatarEventHandler",
            pawnBehaviors: [AvatarPawn],
            actorBehaviors: [AvatarActor]
        },
        {
            name: "BuiltinWalker",
            pawnBehaviors: [WalkerPawn],
        }
    ]
}

/* globals Microverse */
