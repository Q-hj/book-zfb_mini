/*
 * @Date: 2022-06-29 10:52:21
 * @LastEditors: Mr.qin
 * @LastEditTime: 2022-08-16 15:44:56
 * @Description: 场馆预约
 */
var app = getApp();

import user from '/utils/User/user';
import { formatDate, formatIntDate } from '/utils/common';
Page({
	data: {
		popupVisible: true,

		longitude: 120.131441,
		latitude: 30.279383,
		scale: 13,

		isUpdate: false,

		countdown: false,
		apptnumberMin: 1,
		apptnumberMax: 10,
		fireBrigadeId: 0,
		fireBrigadeName: '',
		form: {
			contactNumber: '',
			contactName: '',
			groupName: '',
			visitTime: '',
			eventTime: 0,
			sex: 0,
			vcode: '',
			number: 1,
			remarks: '',
			geocodedCode: '',
		},
		vcode: null,
		visitDate: '',
		visitTime: '',
		visitDateList: [],
		vcodeTime: 60,
	},
	onLoad(query) {
		if (query.id) {
			// 修改
			const form = { ...query, sex: +query.sex };
			this.setData({ isUpdate: true, form });
			console.log(this.data.form);

			const {
				latitude,
				longitude,
				geocodedCode,
				fireBrigadeId,
				fireBrigadeName,
				eventTime,
				visitTime,
				id,
			} = query;
			const visitDate = eventTime;
			// console.log(visitDate);
			this.setData({
				latitude,
				longitude,
				venueLongitude: longitude,
				venueLatitude: latitude,
				geocodedCode,
				fireBrigadeId,
				fireBrigadeName,
				visitDate,
				visitTime,
				eventTime,
				id: +id,
			});

			this.getVenuesList();
			this.getVisitTime(query.fireBrigadeId);
			return;
		}
		user.getLocation().then(({ latitude, longitude, districtAdcode }) => {
			this.setData({
				latitude,
				longitude,
				geocodedCode: districtAdcode,
			});
			this.getVenuesList();
		});
	},
	getVenuesList(range = 0.5) {
		// const { latitude, longitude } = this.data;
		// console.log([latitude, longitude]);
		// const params = {
		// 	lat1: Number(latitude - range),
		// 	lat2: Number(latitude + range),
		// 	lon1: Number(longitude - range),
		// 	lon2: Number(longitude + range),
		// };
		const { geocodedCode } = this.data;
		app.get('/fireBrigades/visit/open', { geocodedCode }).then((venuesList) => {
			this.setData({ venuesList });
			const markers = venuesList.map((venues) => ({
				id: venues.id,
				latitude: venues.latitude,
				longitude: venues.longitude,
				iconPath: '/assets/images/icon_point_red.png',
				width: 40,
				height: 40,

				// label无法单独绑定点击事件
				label: {
					content:
						venues.name ||
						venues.name +
							'\n' +
							'\n ★' +
							venues.stars.toFixed(1) +
							'  开放' +
							venues.count +
							'次' +
							'\n 查看详情',
					color: '#000000',
					fontSize: 16,
					borderRadius: 15,
					bgColor: '#fef8f8',
					padding: 18,
				},
			}));
			this.setData({ markers });
		});
	},
	onRegionChange(e) {
		// console.log(e);
	},
	onMarkerTap({ markerId, ...a }) {
		console.log(a);
		const currentvenues = this.data.venuesList.filter(
			(item) => item.id == markerId
		)[0];
		if (!currentvenues) return;
		this.setData({
			fireBrigadeId: markerId,
			fireBrigadeName: currentvenues.name,
			venueLongitude: currentvenues.longitude,
			venueLatitude: currentvenues.latitude,
		});
		this.getVisitTime(markerId);
		// this.setCustomCallout(currentvenues);
	},
	// 获取场馆开放时间
	getVisitTime(id) {
		// id = 4907; //测试
		app.get('/fireBrigades/visitDateList', { id }).then((dateList) => {
			if (!dateList.length) {
				app.lightTip('该场馆暂无开放时间，请选择其他场馆');
				this.setData({ visitDateList: [] });
				return;
			}
			const visitDateList = dateList.map((date) => ({
				name: formatDate(date.visitDate),
				subList: date.visitTime.map((time) => ({ name: time })),
			}));
			this.setData({ visitDateList });
		});
	},
	// 设置maker文字提示
	setCustomCallout(venues) {
		const customCallout = {
			type: 2,
			descList: [
				{
					desc:
						venues.name +
						'\n' +
						'\n ★' +
						venues.stars.toFixed(1) +
						'  开放' +
						venues.count +
						'次' +
						'\n 查看详情',
					descColor: '#000000',
				},
			],

			isShow: 0,
		};
		this.setData({ customCallout });
	},
	handleSelect() {
		if (!this.data.fireBrigadeName) return app.lightTip('请先选择参观场所');
		my.multiLevelSelect({
			title: '选择参观日期',
			list: this.data.visitDateList,
			success: ({ result }) => {
				if (!result) return;
				this.setData({
					visitDate: result[0].name,
					visitTime: result[1].name,
				});

				const params = {
					id: this.data.fireBrigadeId,
					date: formatIntDate(this.data.visitDate),
				};
				app
					.get('/fireBrigades/visitDate', params)
					.then(({ apptnumberMax, apptnumberMin }) =>
						this.setData({ apptnumberMax, apptnumberMin })
					)
					.catch(() =>
						this.setData({
							visitDate: '',
							visitTime: '',
						})
					);
			},
		});
	},
	getCode() {
		if (this.data.countdown) return;
		const resPhone = /^1[3|4|5|6|7|8|9][0-9]\d{8}$/;
		const phone = this.data.form.contactNumber;

		if (!phone) return my.alert({ title: '提示', content: '请填写手机号！' });
		if (!resPhone.test(phone))
			return my.alert({ title: '提示', content: '手机号码格式不正确！' });
		// 发送验证码
		app.post('/sms/vcode', { phone }).then(({ message }) => {
			app.lightTip('验证码已发送');
			this.setData({ countdown: true, vcode: message });
			this.handleCountdown();
		});
	},
	// 倒计时
	handleCountdown() {
		this.setData({ vcodeTime: 60 });
		const vcodeTimer = setInterval(() => {
			const vcodeTime = this.data.vcodeTime - 1;
			if (vcodeTime) this.setData({ vcodeTime });
			else {
				this.setData({ countdown: false });
				clearInterval(vcodeTimer);
			}
		}, 1000);
	},
	onSubmit(form) {
		if (!this.data.visitDate) return app.lightTip('请选择参观时间');
		if (this.data.vcode != form.vcode) return app.lightTip('验证码不正确');
		if (!form.vcode) return app.lightTip('请验证手机号');

		const { visitDate, visitTime, geocodedCode, fireBrigadeId, id } = this.data;

		const params = {
			...form,
			id,
			fireBrigadeId,
			geocodedCode,
			visitTime,
			eventTime: formatIntDate(visitDate),
			// formId: '',
		};
		console.log(url);
		const url = id ? 'editFireVisit' : 'saveFireVisit';
		app.post('/fireVisitAPPT/' + url, params).then(({ message }) => {
			app.showResult(message);
			setTimeout(() => {
				my.redirectTo({ url: '/pages/history/history' });
			}, 1000);
		});
	},
	handleValuesChange(value, form) {
		// 输入手机号时 更新form
		// if (value.hasOwnProperty("contactNumber")) this.setData({ form });
		// 输入内容时 更新form
		this.setData({ form });
	},
	onCalloutTap({ markerId }) {
		my.navigateTo({
			url: '/pages/venueDeatil/venueDeatil?fireBrigadeId=' + markerId,
		});
	},
	handleNavigation() {
		const { venueLongitude, venueLatitude, fireBrigadeName } = this.data;
		my.openLocation({
			longitude: venueLongitude,
			latitude: venueLatitude,
			name: fireBrigadeName,
			address: ' ',
		});
	},
	handleAgree() {
		this.setData({ popupVisible: false });
	},
	handleNoAgree() {
		my.navigateBack();
	},
});
